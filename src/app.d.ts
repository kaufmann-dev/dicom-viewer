// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			/** Set when the request carries a valid OIDC admin session. */
			admin: { id: string; name: string; email: string } | null;
			/** Set when the request carries a valid passcode session (and no admin session). */
			viewer: { passcodeId: string; label: string; expiresAt: Date } | null;
		}
	}
}

export {};
