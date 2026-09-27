import { error } from '@sveltejs/kit';
import { listCatalog } from '$lib/server/access';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const catalog = await listCatalog(locals);
	if (!catalog.some((p) => p.id === params.projectId)) error(404, 'Not found');
	return { catalog };
};
