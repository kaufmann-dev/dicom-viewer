/** Checks that bytes form a binary or ASCII STL mesh. */
export function isStl(bytes: Uint8Array): boolean {
	if (bytes.length >= 84) {
		const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		const triangles = view.getUint32(80, true);
		if (triangles > 0 && 84 + triangles * 50 === bytes.length) return true;
	}
	const head = new TextDecoder().decode(bytes.subarray(0, 1024)).trimStart().toLowerCase();
	return head.startsWith('solid') && head.includes('facet');
}

export function stlLabel(filename: string): string {
	const base = filename.split(/[/\\]/).pop() ?? filename;
	return base.replace(/\.stl$/i, '') || 'Model';
}
