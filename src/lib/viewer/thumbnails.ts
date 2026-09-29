import { cache as imageCache, metaData, utilities } from '@cornerstonejs/core';
import { clearInstanceMetadata, imageIdFor, initCornerstone } from './cornerstone';
import { overlayBitmap, overlayPlanes } from './dicom-overlay';

const SIZE = 320;

export type ThumbnailKind = 'image' | 'stl';
const CONCURRENCY = 4;

/** Rendered thumbnails for this browser session, keyed by instance id. */
const rendered = new Map<string, string>();
const pending = new Map<string, Promise<string>>();
/** Thumbnails this browser session already stored on the server. */
const stored = new Set<string>();
const queue: (() => void)[] = [];
let active = 0;

function next() {
	if (active >= CONCURRENCY) return;
	const job = queue.shift();
	if (!job) return;
	active++;
	job();
}

async function render(instanceId: string, kind: ThumbnailKind): Promise<string> {
	if (kind === 'stl') {
		const { renderStlThumbnail } = await import('./stl-thumbnail');
		return renderStlThumbnail(instanceId, SIZE);
	}
	initCornerstone();
	const canvas = document.createElement('canvas');
	canvas.width = SIZE;
	canvas.height = SIZE;
	// CPU rendering: the GPU path shares one hidden rendering engine and stalls when used
	// concurrently.
	const imageId = imageIdFor(instanceId);
	await utilities.loadImageToCanvas({ canvas, imageId, thumbnail: true, useCPURendering: true });
	drawOverlays(canvas, imageId);
	return canvas.toDataURL('image/jpeg', 0.85);
}

/** Draws the image's overlay planes where the CPU renderer fitted the image: scaled and centered. */
function drawOverlays(canvas: HTMLCanvasElement, imageId: string) {
	const planes = overlayPlanes(metaData.get('naturalized', imageId));
	const image = imageCache.getImage(imageId);
	if (!planes.length || !image) return;
	const scale = Math.min(canvas.width / image.columns, canvas.height / image.rows);
	const left = (canvas.width - image.columns * scale) / 2;
	const top = (canvas.height - image.rows * scale) / 2;
	const context = canvas.getContext('2d')!;
	for (const plane of planes) {
		context.drawImage(
			overlayBitmap(plane),
			left + plane.x * scale,
			top + plane.y * scale,
			plane.columns * scale,
			plane.rows * scale
		);
	}
}

export function cachedThumbnail(instanceId: string): string | undefined {
	return rendered.get(instanceId);
}

/** Renders the DICOM image or STL model to a data URL, a few at a time, and remembers the result. */
export function loadThumbnail(instanceId: string, kind: ThumbnailKind): Promise<string> {
	const known = rendered.get(instanceId);
	if (known) return Promise.resolve(known);
	let promise = pending.get(instanceId);
	if (!promise) {
		promise = new Promise<string>((resolve, reject) => {
			queue.push(() => {
				render(instanceId, kind)
					.then((url) => {
						rendered.set(instanceId, url);
						resolve(url);
					}, reject)
					.finally(() => {
						pending.delete(instanceId);
						active--;
						next();
					});
			});
			next();
		});
		pending.set(instanceId, promise);
	}
	return promise;
}

/** Stores a rendered thumbnail on the server, so later visitors load it instead of rendering. */
export async function storeThumbnail(instanceId: string, dataUrl: string): Promise<void> {
	if (stored.has(instanceId)) return;
	const body = await (await fetch(dataUrl)).blob();
	const response = await fetch(`/api/admin/thumbnails/${instanceId}`, {
		method: 'PUT',
		headers: { 'content-type': 'image/jpeg' },
		body
	});
	if (!response.ok) throw new Error(`Storing the thumbnail failed: ${response.status}`);
	stored.add(instanceId);
}

/** Frees decoded images and DICOM data once thumbnails are no longer displayed. */
export function releaseThumbnailData(): void {
	queue.length = 0;
	pending.clear();
	imageCache.purgeCache();
	clearInstanceMetadata();
}
