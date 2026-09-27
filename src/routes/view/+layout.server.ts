import { canDownload } from '$lib/server/access';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({
	role: locals.admin ? ('admin' as const) : ('viewer' as const),
	accessUntil: locals.viewer?.expiresAt ?? null,
	canDownload: canDownload(locals)
});
