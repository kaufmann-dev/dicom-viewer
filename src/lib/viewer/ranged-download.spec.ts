import { afterEach, describe, expect, it, vi } from 'vitest';
import { rangedDownload } from './ranged-download';

const CHUNK = 8 * 1024 * 1024;

/** Serves `file` with byte ranges, failing the requests whose numbers are listed in `failures`. */
function serve(file: Uint8Array, failures: number[] = []) {
	let requests = 0;
	const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
		requests++;
		if (failures.includes(requests)) throw new TypeError('Load failed');
		const range = new Headers(init.headers).get('range')!;
		const [start, end] = /bytes=(\d+)-(\d+)/.exec(range)!.slice(1).map(Number);
		const last = Math.min(end, file.length - 1);
		return new Response(file.slice(start, last + 1), {
			status: 206,
			headers: { 'content-range': `bytes ${start}-${last}/${file.length}` }
		});
	});
	vi.stubGlobal('fetch', fetchMock);
	return fetchMock;
}

/** Byte comparison; `toEqual` on multi-megabyte arrays exhausts the worker. */
function same(data: ArrayBuffer, expected: Uint8Array): boolean {
	return Buffer.from(data).equals(expected);
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('rangedDownload', () => {
	const file = new Uint8Array(CHUNK * 2 + 123).map((_, i) => i % 251);

	it('assembles the file from ranges and reports progress', async () => {
		const fetchMock = serve(file);
		const progress: number[] = [];
		const data = await rangedDownload('/f', (loaded) => progress.push(loaded));
		expect(same(data, file)).toBe(true);
		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect(progress).toEqual([CHUNK, CHUNK * 2, file.length]);
	});

	it('retries a failed range', async () => {
		vi.useFakeTimers();
		const fetchMock = serve(file, [2]);
		const download = rangedDownload('/f');
		await vi.runAllTimersAsync();
		expect(same(await download, file)).toBe(true);
		expect(fetchMock).toHaveBeenCalledTimes(4);
		vi.useRealTimers();
	});

	it('gives up after three failed attempts', async () => {
		vi.useFakeTimers();
		serve(file, [2, 3, 4]);
		const download = rangedDownload('/f');
		const assertion = expect(download).rejects.toThrow('Load failed');
		await vi.runAllTimersAsync();
		await assertion;
		vi.useRealTimers();
	});

	it('accepts a server that ignores the range', async () => {
		vi.stubGlobal('fetch', async () => new Response(file.slice(0, 10)));
		expect(same(await rangedDownload('/f'), file.slice(0, 10))).toBe(true);
	});
});
