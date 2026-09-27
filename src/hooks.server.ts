import { json, redirect, type Handle, type ServerInit } from '@sveltejs/kit';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { readViewerSession } from '$lib/server/viewer-auth';

export const init: ServerInit = async () => {
	await migrate(db, { migrationsFolder: 'drizzle' });
};

function under(path: string, prefix: string): boolean {
	return path === prefix || path.startsWith(`${prefix}/`);
}

export const handle: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });
	event.locals.admin = session
		? { id: session.user.id, name: session.user.name, email: session.user.email }
		: null;
	event.locals.viewer = session ? null : await readViewerSession(event.cookies);

	const { pathname, search } = event.url;
	const { admin, viewer } = event.locals;

	if (under(pathname, '/api/admin') && !admin) {
		return json({ message: 'Admin sign-in required' }, { status: 401 });
	}
	if (under(pathname, '/admin') && !admin) {
		redirect(303, `/?returnTo=${encodeURIComponent(pathname + search)}`);
	}
	if (under(pathname, '/api/files') && !admin && !viewer) {
		return json({ message: 'Sign-in required' }, { status: 401 });
	}
	if (under(pathname, '/view') && !admin && !viewer) {
		redirect(303, '/');
	}

	const response = await svelteKitHandler({ event, resolve, auth, building });
	if (under(pathname, '/api') && !response.headers.has('cache-control')) {
		response.headers.set('cache-control', 'private, no-store');
	}
	return response;
};
