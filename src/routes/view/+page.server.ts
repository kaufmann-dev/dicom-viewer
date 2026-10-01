import { redirect } from '@sveltejs/kit';
import { listCatalog } from '#lib/server/access.js';
import type { PageServerLoad } from './$types';

/** Opens the project with the newest study, or shows the empty state. */
export const load: PageServerLoad = async ({ locals }) => {
	const [first] = await listCatalog(locals);
	if (first) redirect(307, `/view/projects/${first.id}`);
};
