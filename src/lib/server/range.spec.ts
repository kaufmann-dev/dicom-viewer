import { describe, expect, it } from 'vitest';
import { parseRange } from './range';

describe('parseRange', () => {
	it('reads closed and open ranges', () => {
		expect(parseRange('bytes=0-99', 1000)).toEqual({ start: 0, end: 99 });
		expect(parseRange('bytes=900-', 1000)).toEqual({ start: 900, end: 999 });
	});

	it('clamps the end to the file', () => {
		expect(parseRange('bytes=500-5000', 1000)).toEqual({ start: 500, end: 999 });
	});

	it('sends the whole file without a usable range', () => {
		expect(parseRange(null, 1000)).toBeNull();
		expect(parseRange('bytes=-100', 1000)).toBeNull();
		expect(parseRange('bytes=0-9,20-29', 1000)).toBeNull();
		expect(parseRange('items=0-9', 1000)).toBeNull();
	});

	it('rejects ranges outside the file', () => {
		expect(parseRange('bytes=1000-', 1000)).toBe('unsatisfiable');
		expect(parseRange('bytes=10-5', 1000)).toBe('unsatisfiable');
	});
});
