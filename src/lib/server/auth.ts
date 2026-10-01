import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { genericOAuth } from 'better-auth/plugins';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import * as env from '$app/env/private';
import { db } from '#lib/server/db/index.js';
import * as schema from '#lib/server/db/schema.js';

export const OIDC_PROVIDER_ID = 'oidc';

function required(name: keyof typeof env): string {
	const value = env[name];
	if (!value) throw new Error(`${name} is not set`);
	return value;
}

/**
 * Admin authentication. Any account the OIDC provider admits is the admin;
 * the provider's access policy is the only admission control.
 */
export const auth = betterAuth({
	baseURL: required('BETTER_AUTH_URL'),
	secret: required('BETTER_AUTH_SECRET'),
	database: drizzleAdapter(db, { provider: 'pg', schema }),
	emailAndPassword: { enabled: false },
	session: {
		expiresIn: 60 * 60 * 24 * 7,
		disableSessionRefresh: true
	},
	plugins: [
		genericOAuth({
			config: [
				{
					providerId: OIDC_PROVIDER_ID,
					discoveryUrl: required('OIDC_DISCOVERY_URL'),
					clientId: required('OIDC_CLIENT_ID'),
					clientSecret: required('OIDC_CLIENT_SECRET'),
					scopes: ['openid', 'profile', 'email']
				}
			]
		}),
		sveltekitCookies(getRequestEvent)
	]
});
