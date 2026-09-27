import { describe, expect, it } from 'vitest';
import { overlayPlanes } from './dicom-overlay';

// 4×4 plane; bits are packed least significant bit first: pixels 0, 5, 10 and 15 are set.
const BYTES = [0b00100001, 0b10000100];

function natural(data: unknown, extra: Record<string, unknown> = {}) {
	return {
		OverlayRows: 4,
		OverlayColumns: 4,
		OverlayOrigin: [2, 3],
		OverlayBitsAllocated: 1,
		OverlayData: data,
		...extra
	};
}

describe('overlayPlanes', () => {
	it('unpacks the bits and converts the 1-based [row, column] origin', () => {
		const [plane] = overlayPlanes(natural([new Uint8Array(BYTES).buffer]));
		expect(plane).toMatchObject({ rows: 4, columns: 4, x: 2, y: 1 });
		expect([...plane.mask]).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
	});

	it('accepts a bare ArrayBuffer or a typed array', () => {
		expect(overlayPlanes(natural(new Uint8Array(BYTES).buffer))).toHaveLength(1);
		expect(overlayPlanes(natural(new Uint8Array([0, ...BYTES]).subarray(1)))[0].mask[5]).toBe(1);
	});

	it('returns nothing without overlay data', () => {
		expect(overlayPlanes(natural(undefined))).toEqual([]);
		expect(overlayPlanes(undefined)).toEqual([]);
	});

	it('ignores overlays embedded in the pixel data', () => {
		const data = [new Uint8Array(BYTES).buffer];
		expect(overlayPlanes(natural(data, { OverlayBitsAllocated: 16 }))).toEqual([]);
	});
});
