import { defineEnvVars } from '@sveltejs/kit/env';

const optional = (input: string | undefined) => input;

export const variables = defineEnvVars({
	DATA_DIR: { description: 'Directory for stored DICOM files and thumbnails', schema: optional },
	DATABASE_URL: { description: 'PostgreSQL connection string', schema: optional },
	BETTER_AUTH_URL: {
		description: 'Public origin of the app (same value as ORIGIN)',
		schema: optional
	},
	BETTER_AUTH_SECRET: {
		description: 'Secret signing Better Auth session cookies',
		schema: optional
	},
	OIDC_DISCOVERY_URL: { description: 'OIDC discovery document URL', schema: optional },
	OIDC_CLIENT_ID: { description: 'OIDC client ID', schema: optional },
	OIDC_CLIENT_SECRET: { description: 'OIDC client secret', schema: optional }
});
