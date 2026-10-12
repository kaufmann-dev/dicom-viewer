import { describe, expect, it } from 'vitest';
import { studyKey } from './catalog';

describe('studyKey', () => {
	it('groups models and uploaded files apart from DICOM studies', () => {
		expect(studyKey({ kind: 'stl', studyInstanceUid: null })).toBe('stl');
		expect(studyKey({ kind: 'photo', studyInstanceUid: null })).toBe('files');
		expect(studyKey({ kind: 'pdf', studyInstanceUid: null })).toBe('files');
		expect(studyKey({ kind: 'pdf', studyInstanceUid: '1.2' })).toBe('1.2');
		expect(studyKey({ kind: 'image', studyInstanceUid: null })).toBe('unknown');
	});
});
