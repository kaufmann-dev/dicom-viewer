import type { Types } from '@cornerstonejs/core';
import { describe, expect, it } from 'vitest';
import { presetThreshold, shiftPreset } from './volume-threshold';

const preset: Types.ViewportPreset = {
	name: 'Test',
	gradientOpacity: '4 0 1 255 1',
	specularPower: '10',
	scalarOpacity: '8 -3000 0 -20 0 600 0.7 3000 0.7',
	specular: '0.2',
	shade: '1',
	ambient: '0.1',
	colorTransfer: '8 -3000 0 0 0 600 0.9 0.8 0.5',
	diffuse: '0.9',
	interpolation: '1'
};

describe('presetThreshold', () => {
	it('returns where the opacity leaves zero', () => {
		expect(presetThreshold(preset)).toBe(-20);
	});

	it('returns null when the lowest values are already visible', () => {
		expect(presetThreshold({ ...preset, scalarOpacity: '6 -3000 0.7 -500 0 3000 0' })).toBeNull();
	});
});

describe('shiftPreset', () => {
	it('moves every opacity and color point by the offset', () => {
		const shifted = shiftPreset(preset, 200);
		expect(shifted.scalarOpacity).toBe('8 -2800 0 180 0 800 0.7 3200 0.7');
		expect(shifted.colorTransfer).toBe('8 -2800 0 0 0 800 0.9 0.8 0.5');
		expect({ ...shifted, scalarOpacity: '', colorTransfer: '' }).toEqual({
			...preset,
			scalarOpacity: '',
			colorTransfer: ''
		});
		expect(presetThreshold(shifted)).toBe(180);
	});
});
