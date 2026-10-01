import { z } from 'zod';
import { normalizeCode } from '#lib/server/passcode.js';

export const idSchema = z.uuid();

export const nameSchema = z
	.string()
	.trim()
	.min(1, 'Enter a name.')
	.max(200, 'Use at most 200 characters.');

/** Codes are stored normalized, so viewers may type them in any case and with spaces or dashes. */
export const codeSchema = z
	.string()
	.transform(normalizeCode)
	.pipe(
		z
			.string()
			.min(6, 'Use at least 6 letters or digits.')
			.max(64, 'Use at most 64 letters or digits.')
	);
