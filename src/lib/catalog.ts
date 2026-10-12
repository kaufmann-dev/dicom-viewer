import { DOSE_SR_SOP_CLASS } from '#lib/sr.js';

/** DICOM image series, DICOM structured report, STL mesh, photo file, or PDF (file or DICOM). */
export type ItemKind = 'image' | 'sr' | 'stl' | 'photo' | 'pdf';

export type CatalogItem = {
	id: string;
	kind: ItemKind;
	label: string;
	modality: string | null;
	sopClassUid: string | null;
	instanceCount: number;
	volume: boolean;
	seriesNumber: number | null;
	/** Middle instance of an image series, or the file of a single-file item, used for its thumbnail. */
	thumbnail: ThumbnailRef | null;
};

/** The instance a thumbnail is rendered from, and whether the server already stores it. */
export type ThumbnailRef = { instanceId: string; stored: boolean };

export type MissingThumbnail = { instanceId: string; kind: Exclude<ItemKind, 'sr'> };

export type CatalogStudy = {
	key: string;
	date: string | null;
	description: string | null;
	items: CatalogItem[];
};

export type CatalogProject = { id: string; name: string; studies: CatalogStudy[] };

export type ItemFilter =
	'all' | 'images' | 'volumes' | 'reports' | 'models' | 'photos' | 'documents';

/** Groups of items outside DICOM studies: STL models, and uploaded photos and PDF files. */
export const MODELS_KEY = 'stl';
export const FILES_KEY = 'files';

/** The study an item is listed and downloaded under. */
export function studyKey(row: { kind: ItemKind; studyInstanceUid: string | null }): string {
	if (row.kind === 'stl') return MODELS_KEY;
	if ((row.kind === 'photo' || row.kind === 'pdf') && row.studyInstanceUid === null) {
		return FILES_KEY;
	}
	return row.studyInstanceUid ?? 'unknown';
}

/** Name of the groups that are not DICOM studies. */
export function groupName(key: string): string | null {
	if (key === MODELS_KEY) return '3D models';
	if (key === FILES_KEY) return 'Photos & documents';
	return null;
}

export function isDoseReport(item: CatalogItem): boolean {
	return item.kind === 'sr' && item.sopClassUid === DOSE_SR_SOP_CLASS;
}

export function matchesFilter(item: CatalogItem, filter: ItemFilter): boolean {
	switch (filter) {
		case 'all':
			return true;
		case 'images':
			return item.kind === 'image' && !item.volume;
		case 'volumes':
			return item.kind === 'image' && item.volume;
		case 'reports':
			return item.kind === 'sr';
		case 'models':
			return item.kind === 'stl';
		case 'photos':
			return item.kind === 'photo';
		case 'documents':
			return item.kind === 'pdf';
	}
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Formats a DICOM date (YYYYMMDD) as "13 Jan 2025", identically on server and client. */
export function formatStudyDate(value: string | null): string {
	const m = value ? /^(\d{4})(\d{2})(\d{2})/.exec(value) : null;
	if (!m) return '';
	return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

/** Order inside a study: 3D volumes, other images, models, photos, PDFs, reports, dose reports. */
export function itemOrder(item: CatalogItem): number {
	if (item.kind === 'image') return item.volume ? 0 : 1;
	if (item.kind === 'stl') return 2;
	if (item.kind === 'photo') return 3;
	if (item.kind === 'pdf') return 4;
	return isDoseReport(item) ? 6 : 5;
}
