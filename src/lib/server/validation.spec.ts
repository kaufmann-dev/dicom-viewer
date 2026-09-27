import { describe, expect, it } from 'vitest';
import { codeSchema } from './validation';

describe('codeSchema', () => {
	it('normalizes chosen codes and requires at least six letters or digits', () => {
		expect(codeSchema.parse('knee-mri 24')).toBe('KNEEMRI24');
		expect(codeSchema.safeParse('ab-12').success).toBe(false);
	});
});
