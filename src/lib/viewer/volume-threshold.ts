import type { Types } from '@cornerstonejs/core';

/** Slider range in HU around the selected preset's own threshold. */
export const THRESHOLD_SHIFT = { below: 1000, above: 1500, step: 10 };

/** Parses a preset transfer function string: a point count followed by the values. */
function parsePoints(value: string): number[] {
	return value.split(' ').slice(1).map(Number);
}

function shiftPoints(value: string, stride: number, offset: number): string {
	const [count] = value.split(' ');
	const values = parsePoints(value).map((v, i) => (i % stride === 0 ? v + offset : v));
	return [count, ...values].join(' ');
}

/**
 * The HU value where the preset's opacity starts to rise, or null when the preset has no fully
 * transparent low range (`CT-Air` shows low densities and hides high ones).
 */
export function presetThreshold(preset: Types.ViewportPreset): number | null {
	const points = parsePoints(preset.scalarOpacity);
	if (points[1] !== 0) return null;
	let threshold = points[0];
	for (let i = 0; i < points.length && points[i + 1] === 0; i += 2) threshold = points[i];
	return threshold;
}

/** Moves the preset's opacity and color transfer functions along the HU axis. */
export function shiftPreset(preset: Types.ViewportPreset, offset: number): Types.ViewportPreset {
	return {
		...preset,
		scalarOpacity: shiftPoints(preset.scalarOpacity, 2, offset),
		colorTransfer: shiftPoints(preset.colorTransfer, 4, offset)
	};
}
