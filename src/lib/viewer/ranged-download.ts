const CHUNK_SIZE = 8 * 1024 * 1024;
const ATTEMPTS = 3;

/**
 * Downloads a file in byte ranges into one preallocated buffer, retrying each range. Chrome on iOS
 * fails single downloads of large STL models with "Load failed", while Safari loads them.
 */
export async function rangedDownload(
	url: string,
	onProgress?: (loaded: number, total: number) => void,
	signal?: AbortSignal
): Promise<ArrayBuffer> {
	const first = await fetchRange(url, 0, signal);
	// Servers that ignore the range send the whole file.
	if (first.total === undefined) return first.data.buffer;

	const bytes = new Uint8Array(first.total);
	bytes.set(first.data);
	let loaded = first.data.byteLength;
	onProgress?.(loaded, first.total);
	while (loaded < first.total) {
		const { data } = await fetchRange(url, loaded, signal);
		if (!data.byteLength) throw new Error(`${url} ended after ${loaded} bytes`);
		bytes.set(data, loaded);
		loaded += data.byteLength;
		onProgress?.(loaded, first.total);
	}
	return bytes.buffer;
}

/** One range; `total` is the file size, or undefined when the server sent the whole file. */
async function fetchRange(url: string, start: number, signal?: AbortSignal) {
	const range = `bytes=${start}-${start + CHUNK_SIZE - 1}`;
	for (let attempt = 1; ; attempt++) {
		try {
			const response = await fetch(url, { headers: { range }, signal });
			if (response.status === 200 && start === 0) {
				return { data: new Uint8Array(await response.arrayBuffer()), total: undefined };
			}
			if (response.status !== 206) throw new Error(`${url} responded with ${response.status}`);
			const total = Number(response.headers.get('content-range')?.split('/')[1]);
			if (!Number.isSafeInteger(total)) throw new Error(`${url} sent no file size`);
			return { data: new Uint8Array(await response.arrayBuffer()), total };
		} catch (error) {
			if (signal?.aborted || attempt === ATTEMPTS) throw error;
			await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
		}
	}
}
