import { describe, expect, it } from 'vitest';
import {
	FailureLimiter,
	generateCode,
	normalizeCode,
	safeReturnTo,
	VIEWER_SESSION_MAX_MS,
	viewerSessionExpiry
} from './passcode';

describe('passcodes', () => {
	it('generates unambiguous 10-character codes', () => {
		const code = generateCode();
		expect(code).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
	});

	it('normalizes typed codes', () => {
		expect(normalizeCode(' abcd-efgh 23 ')).toBe('ABCDEFGH23');
	});

	it('ends viewer sessions at passcode expiry or after seven days', () => {
		const now = new Date('2026-01-01T00:00:00Z');
		const soon = new Date('2026-01-02T00:00:00Z');
		const later = new Date('2026-03-01T00:00:00Z');
		expect(viewerSessionExpiry(soon, now)).toEqual(soon);
		expect(viewerSessionExpiry(later, now).getTime()).toBe(now.getTime() + VIEWER_SESSION_MAX_MS);
	});
});

describe('FailureLimiter', () => {
	it('blocks after the maximum failures until the window ends', () => {
		const limiter = new FailureLimiter(5, 1000);
		for (let i = 0; i < 4; i++) limiter.recordFailure('ip', 0);
		expect(limiter.isBlocked('ip', 10)).toBe(false);
		limiter.recordFailure('ip', 10);
		expect(limiter.isBlocked('ip', 20)).toBe(true);
		expect(limiter.isBlocked('other', 20)).toBe(false);
		expect(limiter.isBlocked('ip', 1000)).toBe(false);
	});
});

describe('safeReturnTo', () => {
	it('allows only same-origin paths', () => {
		expect(safeReturnTo('/admin/passcodes', '/admin')).toBe('/admin/passcodes');
		expect(safeReturnTo('//evil.example', '/admin')).toBe('/admin');
		expect(safeReturnTo('/\\evil.example', '/admin')).toBe('/admin');
		expect(safeReturnTo('https://evil.example', '/admin')).toBe('/admin');
		expect(safeReturnTo(null, '/admin')).toBe('/admin');
	});
});
