import { fail, redirect } from '@sveltejs/kit';
import { safeReturnTo } from '#lib/server/passcode.js';
import { passcodeLimiter, signInWithPasscode } from '#lib/server/viewer-auth.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.admin) redirect(303, safeReturnTo(url.searchParams.get('returnTo'), '/admin'));
	if (locals.viewer) redirect(303, '/view');
	return {
		returnTo: safeReturnTo(url.searchParams.get('returnTo'), '/admin'),
		oidcError: url.searchParams.has('error')
	};
};

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress }) => {
		const client = getClientAddress();
		if (passcodeLimiter.isBlocked(client)) {
			return fail(429, { message: 'Too many failed attempts. Try again in 15 minutes.' });
		}
		const code = String((await request.formData()).get('code') ?? '');
		const result = await signInWithPasscode(cookies, code);
		if (result === 'ok') redirect(303, '/view');

		passcodeLimiter.recordFailure(client);
		return fail(400, {
			message:
				result === 'expired'
					? 'This passcode has expired. Ask for a new one.'
					: 'This passcode is not valid.'
		});
	}
};
