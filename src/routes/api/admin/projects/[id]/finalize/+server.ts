import { error } from '@sveltejs/kit';
import { missingThumbnails } from '#lib/server/access.js';
import { finalizeProject } from '#lib/server/ingest.js';
import { idSchema } from '#lib/server/validation.js';
import type { RequestHandler } from './$types';

/** Also lists the thumbnails still missing, so the uploading browser can render and store them. */
export const POST: RequestHandler = async ({ params }) => {
	if (!idSchema.safeParse(params.id).success) error(404, 'Project not found');
	await finalizeProject(params.id);
	return Response.json({ missingThumbnails: await missingThumbnails(params.id) });
};
