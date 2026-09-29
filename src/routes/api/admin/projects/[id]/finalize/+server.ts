import { error, json } from '@sveltejs/kit';
import { missingThumbnails } from '$lib/server/access';
import { finalizeProject } from '$lib/server/ingest';
import { idSchema } from '$lib/server/validation';
import type { RequestHandler } from './$types';

/** Also lists the thumbnails still missing, so the uploading browser can render and store them. */
export const POST: RequestHandler = async ({ params }) => {
	if (!idSchema.safeParse(params.id).success) error(404, 'Project not found');
	await finalizeProject(params.id);
	return json({ missingThumbnails: await missingThumbnails(params.id) });
};
