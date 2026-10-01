import { redirect } from '@sveltejs/kit';
import { signOutViewer } from '#lib/server/viewer-auth.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => redirect(303, '/');

export const actions: Actions = {
	default: async ({ cookies }) => {
		await signOutViewer(cookies);
		redirect(303, '/');
	}
};
