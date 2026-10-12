/** A photo or PDF uploaded as a plain file, recognized by its content. */
export type PlainFile = { kind: 'photo' | 'pdf'; extension: string };

const CONTENT_TYPES: Record<string, string> = {
	dcm: 'application/dicom',
	stl: 'model/stl',
	pdf: 'application/pdf',
	jpg: 'image/jpeg',
	png: 'image/png',
	gif: 'image/gif',
	webp: 'image/webp',
	avif: 'image/avif'
};

function ascii(bytes: Uint8Array, start: number, end: number): string {
	return String.fromCharCode(...bytes.subarray(start, end));
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
	return signature.every((byte, i) => bytes[i] === byte);
}

/** Whether an ISO BMFF file declares an AVIF brand in its leading `ftyp` box. */
function isAvif(bytes: Uint8Array): boolean {
	if (bytes.length < 16 || ascii(bytes, 4, 8) !== 'ftyp') return false;
	const size = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
	const end = Math.min(size, bytes.length);
	const brands = [ascii(bytes, 8, 12)];
	for (let offset = 16; offset + 4 <= end; offset += 4)
		brands.push(ascii(bytes, offset, offset + 4));
	return brands.some((brand) => brand === 'avif' || brand === 'avis');
}

/**
 * Recognizes PDFs and the photo formats every current browser displays. SVG is not accepted: it is
 * served from this origin and could run scripts.
 */
export function detectPlainFile(bytes: Uint8Array): PlainFile | null {
	if (isPdf(bytes)) return { kind: 'pdf', extension: 'pdf' };
	if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { kind: 'photo', extension: 'jpg' };
	if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
		return { kind: 'photo', extension: 'png' };
	}
	const head = ascii(bytes, 0, 6);
	if (head === 'GIF87a' || head === 'GIF89a') return { kind: 'photo', extension: 'gif' };
	if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') {
		return { kind: 'photo', extension: 'webp' };
	}
	if (isAvif(bytes)) return { kind: 'photo', extension: 'avif' };
	return null;
}

/** PDF readers accept the `%PDF-` header anywhere in the first 1024 bytes. */
export function isPdf(bytes: Uint8Array): boolean {
	return ascii(bytes, 0, 1024).includes('%PDF-');
}

/** Content type of a stored file, by its extension. */
export function contentTypeFor(path: string): string {
	const extension = /\.([^./]+)$/.exec(path)?.[1].toLowerCase() ?? '';
	return CONTENT_TYPES[extension] ?? 'application/octet-stream';
}

/** Extension of a stored file, with its dot. */
export function storedExtension(path: string): string {
	return /\.[^./]+$/.exec(path)?.[0] ?? '';
}

/** The PDF of a PDF item: the file itself, or the document extracted next to a DICOM file. */
export function pdfPath(instancePath: string): string {
	return instancePath.replace(/\.[^./]+$/, '') + '.pdf';
}

/** Item label from an uploaded file name: the name without folder and extension. */
export function fileLabel(filename: string, fallback: string): string {
	const base = filename.split(/[/\\]/).pop() ?? filename;
	return base.replace(/\.[^.]+$/, '').trim() || fallback;
}
