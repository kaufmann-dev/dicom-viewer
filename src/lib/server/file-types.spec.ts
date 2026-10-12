import { describe, expect, it } from 'vitest';
import { contentTypeFor, detectPlainFile, fileLabel, pdfPath } from './file-types';

const text = (value: string) => new TextEncoder().encode(value);

function bytes(...parts: (number[] | string)[]): Uint8Array {
	return new Uint8Array(
		parts.flatMap((part) => (typeof part === 'string' ? [...text(part)] : part))
	);
}

describe('detectPlainFile', () => {
	it('recognizes PDFs and browser photo formats by content', () => {
		expect(detectPlainFile(text('%PDF-1.7\n'))).toEqual({ kind: 'pdf', extension: 'pdf' });
		expect(detectPlainFile(bytes([0xff, 0xd8, 0xff, 0xe0]))).toEqual({
			kind: 'photo',
			extension: 'jpg'
		});
		expect(detectPlainFile(bytes([0x89], 'PNG', [0x0d, 0x0a, 0x1a, 0x0a]))?.extension).toBe('png');
		expect(detectPlainFile(text('GIF89a....'))?.extension).toBe('gif');
		expect(detectPlainFile(bytes('RIFF', [0, 0, 0, 0], 'WEBPVP8 '))?.extension).toBe('webp');
		expect(detectPlainFile(bytes([0, 0, 0, 24], 'ftypmif1', [0, 0, 0, 0], 'avif'))?.extension).toBe(
			'avif'
		);
	});

	it('rejects SVG, HEIC and other files', () => {
		expect(detectPlainFile(text('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
		expect(detectPlainFile(bytes([0, 0, 0, 24], 'ftypheic', [0, 0, 0, 0], 'mif1'))).toBeNull();
		expect(detectPlainFile(text('hello'))).toBeNull();
	});
});

describe('stored files', () => {
	it('maps extensions to content types', () => {
		expect(contentTypeFor('a/b.dcm')).toBe('application/dicom');
		expect(contentTypeFor('a/b.stl')).toBe('model/stl');
		expect(contentTypeFor('a/b.webp')).toBe('image/webp');
		expect(contentTypeFor('a/b')).toBe('application/octet-stream');
	});

	it('finds the PDF of plain and DICOM PDF items', () => {
		expect(pdfPath('projects/p/i/abc.pdf')).toBe('projects/p/i/abc.pdf');
		expect(pdfPath('projects/p/i/abc.dcm')).toBe('projects/p/i/abc.pdf');
	});

	it('labels items by file name without folder and extension', () => {
		expect(fileLabel('models/Skull Bone.STL', 'Model')).toBe('Skull Bone');
		expect(fileLabel('IMG_0001.jpeg', 'Photo')).toBe('IMG_0001');
		expect(fileLabel('.pdf', 'Document')).toBe('Document');
	});
});
