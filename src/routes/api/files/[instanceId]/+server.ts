import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { canAccessItem } from '#lib/server/access.js';
import { db } from '#lib/server/db/index.js';
import { instance } from '#lib/server/db/schema.js';
import { contentTypeFor } from '#lib/server/file-types.js';
import { parseRange } from '#lib/server/range.js';
import { resolveStoredPath } from '#lib/server/storage.js';
import type { RequestHandler } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Serves a stored file. Byte ranges let the STL viewer download large models in retryable parts. */
export const GET: RequestHandler = async ({ params, locals, request }) => {
	if (!UUID.test(params.instanceId)) error(404, 'Not found');
	const [row] = await db
		.select({ itemId: instance.itemId, path: instance.path })
		.from(instance)
		.where(eq(instance.id, params.instanceId));
	if (!row || !(await canAccessItem(locals, row.itemId))) error(404, 'Not found');

	const file = resolveStoredPath(row.path);
	const { size } = await stat(file);
	const headers = {
		'content-type': contentTypeFor(row.path),
		'accept-ranges': 'bytes',
		'cache-control': 'private, no-store',
		'x-content-type-options': 'nosniff'
	};
	const range = parseRange(request.headers.get('range'), size);
	if (range === 'unsatisfiable') {
		return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
	}
	const { start, end } = range ?? { start: 0, end: size - 1 };
	const body = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
	return new Response(body, {
		status: range ? 206 : 200,
		headers: {
			...headers,
			'content-length': String(end - start + 1),
			...(range && { 'content-range': `bytes ${start}-${end}/${size}` })
		}
	});
};
