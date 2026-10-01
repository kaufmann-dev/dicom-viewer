import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { canAccessItem } from '#lib/server/access.js';
import { db } from '#lib/server/db/index.js';
import { instance } from '#lib/server/db/schema.js';
import { resolveStoredPath } from '#lib/server/storage.js';
import { thumbnailPath } from '#lib/server/thumbnails.js';
import { idSchema } from '#lib/server/validation.js';
import type { RequestHandler } from './$types';

/** Serves the thumbnail an admin's browser rendered and stored for this instance. */
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!idSchema.safeParse(params.instanceId).success) error(404, 'Not found');
	const [row] = await db
		.select({ itemId: instance.itemId, path: instance.path, thumbnail: instance.thumbnail })
		.from(instance)
		.where(eq(instance.id, params.instanceId));
	if (!row?.thumbnail || !(await canAccessItem(locals, row.itemId))) error(404, 'Not found');

	const file = resolveStoredPath(thumbnailPath(row.path));
	const { size } = await stat(file);
	const body = Readable.toWeb(createReadStream(file)) as ReadableStream;
	return new Response(body, {
		headers: {
			'content-type': 'image/jpeg',
			'content-length': String(size),
			'cache-control': 'private, no-store'
		}
	});
};
