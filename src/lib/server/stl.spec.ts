import { describe, expect, it } from 'vitest';
import { isStl } from './stl';

function binaryStl(triangles: number): Uint8Array {
	const bytes = new Uint8Array(84 + triangles * 50);
	new DataView(bytes.buffer).setUint32(80, triangles, true);
	return bytes;
}

describe('isStl', () => {
	it('accepts binary and ASCII meshes', () => {
		expect(isStl(binaryStl(2))).toBe(true);
		expect(isStl(new TextEncoder().encode('solid part\n facet normal 0 0 1\n'))).toBe(true);
	});

	it('rejects truncated or unrelated files', () => {
		expect(isStl(binaryStl(2).subarray(0, 120))).toBe(false);
		expect(isStl(new TextEncoder().encode('not a mesh'))).toBe(false);
	});
});
