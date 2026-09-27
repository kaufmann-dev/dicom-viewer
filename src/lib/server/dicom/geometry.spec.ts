import { describe, expect, it } from 'vitest';
import { layoutSeries, type InstanceGeometry } from './geometry';

const slice = (id: string, z: number, extra: Partial<InstanceGeometry> = {}) => ({
	id,
	geometry: {
		position: [0, 0, z],
		orientation: [1, 0, 0, 0, 1, 0],
		rows: 512,
		columns: 512,
		frames: 1,
		...extra
	}
});

describe('layoutSeries', () => {
	it('orders slices along the normal and detects a regular volume', () => {
		const layout = layoutSeries([slice('c', 3), slice('a', 1), slice('b', 2)]);
		expect(layout.volume).toBe(true);
		expect([...layout.sortKeys].sort((x, y) => x[1] - y[1]).map(([id]) => id)).toEqual([
			'a',
			'b',
			'c'
		]);
	});

	it('rejects series with gaps, too few slices or duplicate positions', () => {
		expect(layoutSeries([slice('a', 1), slice('b', 2), slice('c', 9)]).volume).toBe(false);
		expect(layoutSeries([slice('a', 1), slice('b', 2)]).volume).toBe(false);
		expect(layoutSeries([slice('a', 1), slice('b', 1), slice('c', 1)]).volume).toBe(false);
	});

	it('rejects mixed orientations and sizes', () => {
		expect(
			layoutSeries([
				slice('a', 1),
				slice('b', 2),
				slice('c', 3, { orientation: [0, 1, 0, 0, 0, 1] })
			]).volume
		).toBe(false);
		expect(layoutSeries([slice('a', 1), slice('b', 2), slice('c', 3, { rows: 256 })]).volume).toBe(
			false
		);
	});

	it('falls back to instance numbers without geometry', () => {
		const layout = layoutSeries([
			{ id: 'x', geometry: { frames: 1, instanceNumber: 2 } },
			{ id: 'y', geometry: { frames: 1, instanceNumber: 1 } }
		]);
		expect(layout.volume).toBe(false);
		expect(layout.sortKeys.get('y')).toBe(1);
		expect(layout.sortKeys.get('x')).toBe(2);
	});
});
