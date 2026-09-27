import { createHash, randomBytes } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { and, eq, gt, lte } from 'drizzle-orm';
import { dev } from '$app/environment';
import { db } from '$lib/server/db';
import { passcode, viewerSession } from '$lib/server/db/schema';
import { FailureLimiter, normalizeCode, viewerSessionExpiry } from '$lib/server/passcode';

export const VIEWER_COOKIE = 'viewer_session';

export const passcodeLimiter = new FailureLimiter(5, 15 * 60 * 1000);

function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export type SignInResult = 'ok' | 'invalid' | 'expired';

export async function signInWithPasscode(cookies: Cookies, input: string): Promise<SignInResult> {
	const code = normalizeCode(input);
	if (!code) return 'invalid';
	const [match] = await db.select().from(passcode).where(eq(passcode.code, code));
	if (!match) return 'invalid';

	const now = new Date();
	if (match.expiresAt <= now) return 'expired';

	await db.delete(viewerSession).where(lte(viewerSession.expiresAt, now));
	const token = randomBytes(32).toString('base64url');
	const expiresAt = viewerSessionExpiry(match.expiresAt, now);
	await db.insert(viewerSession).values({ id: hashToken(token), passcodeId: match.id, expiresAt });
	cookies.set(VIEWER_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		expires: expiresAt
	});
	return 'ok';
}

/** Resolves the viewer session; passcode deletion or expiry ends it immediately. */
export async function readViewerSession(cookies: Cookies): Promise<App.Locals['viewer']> {
	const token = cookies.get(VIEWER_COOKIE);
	if (!token) return null;
	const now = new Date();
	const [row] = await db
		.select({ passcodeId: passcode.id, label: passcode.label, expiresAt: viewerSession.expiresAt })
		.from(viewerSession)
		.innerJoin(passcode, eq(passcode.id, viewerSession.passcodeId))
		.where(
			and(
				eq(viewerSession.id, hashToken(token)),
				gt(viewerSession.expiresAt, now),
				gt(passcode.expiresAt, now)
			)
		);
	if (!row) cookies.delete(VIEWER_COOKIE, { path: '/' });
	return row ?? null;
}

export async function signOutViewer(cookies: Cookies): Promise<void> {
	const token = cookies.get(VIEWER_COOKIE);
	if (token) await db.delete(viewerSession).where(eq(viewerSession.id, hashToken(token)));
	cookies.delete(VIEWER_COOKIE, { path: '/' });
}
