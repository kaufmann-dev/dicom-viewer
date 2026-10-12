import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { canAccessItem } from '#lib/server/access.js';
import { db } from '#lib/server/db/index.js';
import { instance } from '#lib/server/db/schema.js';
import { contentTypeFor } from '#lib/server/file-types.js';
import { resolveStoredPath } from '#lib/server/storage.js';
import type { RequestHandler } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!UUID.test(params.instanceId)) error(404, 'Not found');
	const [row] = await db
		.select({ itemId: instance.itemId, path: instance.path })
		.from(instance)
		.where(eq(instance.id, params.instanceId));
	if (!row || !(await canAccessItem(locals, row.itemId))) error(404, 'Not found');

	const file = resolveStoredPath(row.path);
	const { size } = await stat(file);
	const body = Readable.toWeb(createReadStream(file)) as ReadableStream;
	return new Response(body, {
		headers: {
			'content-type': contentTypeFor(row.path),
			'content-length': String(size),
			'cache-control': 'private, no-store',
			'x-content-type-options': 'nosniff'
		}
	});
};
