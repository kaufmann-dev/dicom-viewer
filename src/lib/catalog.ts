import { DOSE_SR_SOP_CLASS } from '$lib/sr';

export type CatalogItem = {
	id: string;
	kind: 'image' | 'sr' | 'stl';
	label: string;
	modality: string | null;
	sopClassUid: string | null;
	instanceCount: number;
	volume: boolean;
	seriesNumber: number | null;
	/** Middle instance of an image series, used for its thumbnail. */
	thumbnailInstanceId: string | null;
};

export type CatalogStudy = {
	key: string;
	date: string | null;
	description: string | null;
	items: CatalogItem[];
};

export type CatalogProject = { id: string; name: string; studies: CatalogStudy[] };

export type ItemFilter = 'all' | 'images' | 'volumes' | 'reports' | 'models';

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
	}
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Formats a DICOM date (YYYYMMDD) as "13 Jan 2025", identically on server and client. */
export function formatStudyDate(value: string | null): string {
	const m = value ? /^(\d{4})(\d{2})(\d{2})/.exec(value) : null;
	if (!m) return '';
	return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

/** Order inside a study: 3D volumes, other images, models, reports, dose reports. */
export function itemOrder(item: CatalogItem): number {
	if (item.kind === 'image') return item.volume ? 0 : 1;
	if (item.kind === 'stl') return 2;
	return isDoseReport(item) ? 4 : 3;
}
