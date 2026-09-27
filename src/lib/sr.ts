/** A readable DICOM Structured Report, extracted server-side during ingest. */
export type SrDocument = {
	title: string;
	header: { label: string; value: string }[];
	content: SrNode[];
};

export type SrNode = {
	name: string;
	valueType: string;
	value?: string;
	unit?: string;
	children: SrNode[];
};

export const DOSE_SR_SOP_CLASS = '1.2.840.10008.5.1.4.1.1.88.67';

export function formatDicomDate(value: string | null | undefined): string {
	if (!value) return '';
	const m = /^(\d{4})(\d{2})(\d{2})/.exec(value);
	return m ? `${m[1]}-${m[2]}-${m[3]}` : value;
}

export function formatDicomTime(value: string | null | undefined): string {
	if (!value) return '';
	const m = /^(\d{2})(\d{2})?(\d{2})?/.exec(value);
	return m ? [m[1], m[2], m[3]].filter(Boolean).join(':') : value;
}

export function formatDicomDateTime(value: string | null | undefined): string {
	if (!value) return '';
	const date = formatDicomDate(value.slice(0, 8));
	const time = formatDicomTime(value.slice(8));
	return time ? `${date} ${time}` : date;
}
