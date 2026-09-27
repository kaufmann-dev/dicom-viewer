import { describe, expect, it } from 'vitest';
import {
	archiveEntries,
	contentDisposition,
	downloadFilename,
	safeName,
	type DownloadRow
} from './download';

function row(overrides: Partial<DownloadRow>): DownloadRow {
	return {
		projectName: 'Knee',
		itemId: 'series-1',
		kind: 'image',
		label: 'Axial 1mm',
		seriesNumber: 3,
		studyInstanceUid: '1.2.3',
		studyDate: '20250113',
		studyDescription: 'CT Knee',
		createdAt: new Date(0),
		path: 'projects/p/i/x.dcm',
		size: 10,
		...overrides
	};
}

describe('downloads', () => {
	it('makes names safe on every file system', () => {
		expect(safeName('a/b:c*?\t  d.. ', 'x')).toBe('a_b_c__ d');
		expect(safeName('..', 'fallback')).toBe('fallback');
		expect(safeName(null, 'fallback')).toBe('fallback');
		expect(safeName('x'.repeat(100), '')).toHaveLength(80);
	});

	it('lays out series as study and series folders with numbered instances', () => {
		const names = archiveEntries([
			row({ path: 'a' }),
			row({ path: 'b' }),
			row({ itemId: 'report', kind: 'sr', label: 'Report', seriesNumber: null })
		]).map((e) => e.name);
		expect(names).toEqual([
			'Knee/2025-01-13 CT Knee/003 Axial 1mm/IM00001.dcm',
			'Knee/2025-01-13 CT Knee/003 Axial 1mm/IM00002.dcm',
			'Knee/2025-01-13 CT Knee/Report/IM00001.dcm'
		]);
	});

	it('suffixes colliding study and series folders and STL files', () => {
		const names = archiveEntries([
			row({}),
			row({ itemId: 'series-2' }),
			row({ itemId: 'other-study', studyInstanceUid: '9.9' }),
			row({ itemId: 'undated', studyInstanceUid: null, studyDate: null, studyDescription: null }),
			row({ itemId: 'stl-1', kind: 'stl', label: 'Femur' }),
			row({ itemId: 'stl-2', kind: 'stl', label: 'femur' })
		]).map((e) => e.name);
		expect(names).toEqual([
			'Knee/2025-01-13 CT Knee/003 Axial 1mm/IM00001.dcm',
			'Knee/2025-01-13 CT Knee/003 Axial 1mm (2)/IM00001.dcm',
			'Knee/2025-01-13 CT Knee (2)/003 Axial 1mm/IM00001.dcm',
			'Knee/Unknown study/003 Axial 1mm/IM00001.dcm',
			'Knee/3D models/Femur.stl',
			'Knee/3D models/femur (2).stl'
		]);
	});

	it('builds download filenames and headers', () => {
		const name = downloadFilename(['Knie/Hüfte', '', null, 'CT'], '.zip');
		expect(name).toBe('Knie_Hüfte - CT.zip');
		expect(downloadFilename([''], '.zip')).toBe('Download.zip');
		expect(contentDisposition(name)).toBe(
			`attachment; filename="Knie_H_fte - CT.zip"; filename*=UTF-8''Knie_H%C3%BCfte%20-%20CT.zip`
		);
	});
});
