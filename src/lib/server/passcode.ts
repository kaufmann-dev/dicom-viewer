export const VIEWER_SESSION_MAX_MS = 7 * 24 * 60 * 60 * 1000;

/** Accepts codes typed with lowercase letters, spaces or dashes. */
export function normalizeCode(input: string): string {
	return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** A viewer session ends when its passcode expires or seven days after sign-in, whichever is first. */
export function viewerSessionExpiry(passcodeExpiresAt: Date, now: Date): Date {
	return new Date(Math.min(passcodeExpiresAt.getTime(), now.getTime() + VIEWER_SESSION_MAX_MS));
}

/** Counts failed attempts per key within a fixed window. */
export class FailureLimiter {
	private attempts = new Map<string, { count: number; resetAt: number }>();

	constructor(
		private readonly maxFailures: number,
		private readonly windowMs: number
	) {}

	isBlocked(key: string, now = Date.now()): boolean {
		const entry = this.attempts.get(key);
		if (!entry || entry.resetAt <= now) return false;
		return entry.count >= this.maxFailures;
	}

	recordFailure(key: string, now = Date.now()): void {
		const entry = this.attempts.get(key);
		if (!entry || entry.resetAt <= now) {
			this.attempts.set(key, { count: 1, resetAt: now + this.windowMs });
		} else {
			entry.count++;
		}
		if (this.attempts.size > 10_000) {
			for (const [k, v] of this.attempts) if (v.resetAt <= now) this.attempts.delete(k);
		}
	}
}

/** Returns a same-origin path to continue to after sign-in, or the fallback. */
export function safeReturnTo(value: string | null | undefined, fallback: string): string {
	if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
		return fallback;
	}
	return value;
}
