import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { project } from '$lib/server/db/schema';
import { ingestFile } from '$lib/server/ingest';
import { idSchema } from '$lib/server/validation';
import type { RequestHandler } from './$types';

/** Receives one file per request as the raw body; `name` is its path relative to the upload. */
export const PUT: RequestHandler = async ({ params, request, url }) => {
	if (!idSchema.safeParse(params.id).success) error(404, 'Project not found');
	const [row] = await db.select({ id: project.id }).from(project).where(eq(project.id, params.id));
	if (!row) error(404, 'Project not found');

	// SvelteKit drops request bodies that carry no Content-Type.
	if (!request.headers.get('content-type')) {
		error(415, 'Send the file with Content-Type: application/octet-stream');
	}
	const name = url.searchParams.get('name') ?? '';
	const bytes = new Uint8Array(await request.arrayBuffer());
	return json(await ingestFile(row.id, name, bytes));
};
