/** One overlay plane in image pixel coordinates; `mask` holds one byte (0/1) per overlay pixel. */
export type OverlayPlane = {
	rows: number;
	columns: number;
	x: number;
	y: number;
	mask: Uint8Array;
};

function numberAt(value: unknown, index = 0): number | undefined {
	const n = Number(Array.isArray(value) ? value[index] : value);
	return Number.isFinite(n) ? n : undefined;
}

function bytesOf(value: unknown): Uint8Array | undefined {
	const data = Array.isArray(value) ? value[0] : value;
	if (data instanceof ArrayBuffer) return new Uint8Array(data);
	if (ArrayBuffer.isView(data))
		return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
	return undefined;
}

/**
 * Reads the overlay plane (group 6000) from a naturalized dataset. Naturalization maps the
 * repeating groups 6002–601E onto the same keywords, so only the first group is available.
 * Legacy overlays embedded in unused pixel bits (OverlayBitsAllocated > 1) are not supported.
 */
export function overlayPlanes(natural: Record<string, unknown> | undefined): OverlayPlane[] {
	if (!natural) return [];
	const rows = numberAt(natural.OverlayRows);
	const columns = numberAt(natural.OverlayColumns);
	const data = bytesOf(natural.OverlayData);
	if (!rows || !columns || !data || (numberAt(natural.OverlayBitsAllocated) ?? 1) !== 1) return [];
	const size = rows * columns;
	if (data.length * 8 < size) return [];

	// Bits are packed least significant bit first; only the first frame is used.
	const mask = new Uint8Array(size);
	for (let i = 0; i < size; i++) mask[i] = (data[i >> 3] >> (i & 7)) & 1;
	// OverlayOrigin is the 1-based [row, column] of the overlay's top-left pixel.
	const y = (numberAt(natural.OverlayOrigin, 0) ?? 1) - 1;
	const x = (numberAt(natural.OverlayOrigin, 1) ?? 1) - 1;
	return [{ rows, columns, x, y, mask }];
}

/** Draws the plane's set pixels in white on a transparent canvas of the plane's size. */
export function overlayBitmap(plane: OverlayPlane): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = plane.columns;
	canvas.height = plane.rows;
	const context = canvas.getContext('2d')!;
	const pixels = context.createImageData(plane.columns, plane.rows);
	plane.mask.forEach((bit, i) => {
		if (bit) pixels.data.fill(255, i * 4, i * 4 + 4);
	});
	context.putImageData(pixels, 0, 0);
	return canvas;
}
