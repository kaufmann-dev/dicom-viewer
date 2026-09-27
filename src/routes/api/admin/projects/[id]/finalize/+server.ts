import { error, json } from '@sveltejs/kit';
import { finalizeProject } from '$lib/server/ingest';
import { idSchema } from '$lib/server/validation';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params }) => {
	if (!idSchema.safeParse(params.id).success) error(404, 'Project not found');
	await finalizeProject(params.id);
	return json({ ok: true });
};
