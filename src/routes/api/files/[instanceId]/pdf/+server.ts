import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { canAccessItem } from '#lib/server/access.js';
import { db } from '#lib/server/db/index.js';
import { instance, item } from '#lib/server/db/schema.js';
import { pdfPath } from '#lib/server/file-types.js';
import { resolveStoredPath } from '#lib/server/storage.js';
import { idSchema } from '#lib/server/validation.js';
import type { RequestHandler } from './$types';

/** Serves the PDF of a PDF item: the uploaded file, or the document extracted from DICOM. */
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!idSchema.safeParse(params.instanceId).success) error(404, 'Not found');
	const [row] = await db
		.select({ itemId: instance.itemId, path: instance.path, kind: item.kind })
		.from(instance)
		.innerJoin(item, eq(item.id, instance.itemId))
		.where(eq(instance.id, params.instanceId));
	if (row?.kind !== 'pdf' || !(await canAccessItem(locals, row.itemId))) error(404, 'Not found');

	const file = resolveStoredPath(pdfPath(row.path));
	const { size } = await stat(file);
	const body = Readable.toWeb(createReadStream(file)) as ReadableStream;
	return new Response(body, {
		headers: {
			'content-type': 'application/pdf',
			'content-length': String(size),
			'cache-control': 'private, no-store',
			'x-content-type-options': 'nosniff'
		}
	});
};
