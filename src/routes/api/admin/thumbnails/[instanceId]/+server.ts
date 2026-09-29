import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { instance, item } from '$lib/server/db/schema';
import { writeStoredFile } from '$lib/server/storage';
import { isJpeg, thumbnailPath } from '$lib/server/thumbnails';
import { idSchema } from '$lib/server/validation';
import type { RequestHandler } from './$types';

const MAX_BYTES = 1024 * 1024;

/** Stores the JPEG thumbnail the admin's browser rendered for an image or STL instance. */
export const PUT: RequestHandler = async ({ params, request }) => {
	if (!idSchema.safeParse(params.instanceId).success) error(404, 'Not found');
	if (request.headers.get('content-type') !== 'image/jpeg') {
		error(415, 'Send the thumbnail with Content-Type: image/jpeg');
	}
	if (Number(request.headers.get('content-length')) > MAX_BYTES) error(413, 'Thumbnail too large');
	const bytes = new Uint8Array(await request.arrayBuffer());
	if (bytes.length > MAX_BYTES) error(413, 'Thumbnail too large');
	if (!isJpeg(bytes)) error(415, 'Thumbnail is not a JPEG image');

	const [row] = await db
		.select({ path: instance.path, kind: item.kind })
		.from(instance)
		.innerJoin(item, eq(item.id, instance.itemId))
		.where(eq(instance.id, params.instanceId));
	if (!row || row.kind === 'sr') error(404, 'Not found');

	await writeStoredFile(thumbnailPath(row.path), bytes);
	await db.update(instance).set({ thumbnail: true }).where(eq(instance.id, params.instanceId));
	return new Response(null, { status: 204 });
};
