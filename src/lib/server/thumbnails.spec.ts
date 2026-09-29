import { describe, expect, it } from 'vitest';
import { isJpeg, thumbnailPath } from './thumbnails';

describe('thumbnailPath', () => {
	it('replaces the file extension', () => {
		expect(thumbnailPath('projects/p/i/abc.dcm')).toBe('projects/p/i/abc.thumb.jpg');
		expect(thumbnailPath('projects/p/i/abc.stl')).toBe('projects/p/i/abc.thumb.jpg');
	});
});

describe('isJpeg', () => {
	it('accepts the JPEG start marker', () => {
		expect(isJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
	});

	it('rejects other data', () => {
		expect(isJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
		expect(isJpeg(new Uint8Array([]))).toBe(false);
	});
});
