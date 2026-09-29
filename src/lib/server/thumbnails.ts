/** Stored thumbnail of an instance: next to its file, so deleting the item directory removes it. */
export function thumbnailPath(instancePath: string): string {
	return instancePath.replace(/\.[^./]+$/, '') + '.thumb.jpg';
}

export function isJpeg(bytes: Uint8Array): boolean {
	return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}
