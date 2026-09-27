import { z } from 'zod';

export const idSchema = z.uuid();

export const nameSchema = z
	.string()
	.trim()
	.min(1, 'Enter a name.')
	.max(200, 'Use at most 200 characters.');
