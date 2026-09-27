import { cache as imageCache, utilities } from '@cornerstonejs/core';
import { clearInstanceMetadata, imageIdFor, initCornerstone } from './cornerstone';

const SIZE = 320;
const CONCURRENCY = 4;

/** Rendered thumbnails for this browser session, keyed by instance id. */
const rendered = new Map<string, string>();
const pending = new Map<string, Promise<string>>();
const queue: (() => void)[] = [];
let active = 0;

function next() {
	if (active >= CONCURRENCY) return;
	const job = queue.shift();
	if (!job) return;
	active++;
	job();
}

async function render(instanceId: string): Promise<string> {
	initCornerstone();
	const canvas = document.createElement('canvas');
	canvas.width = SIZE;
	canvas.height = SIZE;
	// CPU rendering: the GPU path shares one hidden rendering engine and stalls when used
	// concurrently.
	await utilities.loadImageToCanvas({
		canvas,
		imageId: imageIdFor(instanceId),
		thumbnail: true,
		useCPURendering: true
	});
	return canvas.toDataURL('image/jpeg', 0.85);
}

export function cachedThumbnail(instanceId: string): string | undefined {
	return rendered.get(instanceId);
}

/** Renders the instance to a data URL, a few at a time, and remembers the result. */
export function loadThumbnail(instanceId: string): Promise<string> {
	const known = rendered.get(instanceId);
	if (known) return Promise.resolve(known);
	let promise = pending.get(instanceId);
	if (!promise) {
		promise = new Promise<string>((resolve, reject) => {
			queue.push(() => {
				render(instanceId)
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

/** Frees decoded images and DICOM data once thumbnails are no longer displayed. */
export function releaseThumbnailData(): void {
	queue.length = 0;
	pending.clear();
	imageCache.purgeCache();
	clearInstanceMetadata();
}
