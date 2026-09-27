import { listCatalog } from '$lib/server/access';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({
	catalog: await listCatalog(locals)
});
