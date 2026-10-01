import dcmjs from 'dcmjs';
import type { SrDocument } from '#lib/sr.js';
import type { InstanceGeometry } from './geometry';
import { asString, extractSrDocument } from './sr';

export type ParsedDicom = {
	kind: 'image' | 'sr';
	sopInstanceUid: string;
	sopClassUid: string;
	seriesInstanceUid: string;
	studyInstanceUid: string | null;
	studyDate: string | null;
	studyDescription: string | null;
	seriesDescription: string | null;
	seriesNumber: number | null;
	modality: string | null;
	geometry: InstanceGeometry;
	sr: SrDocument | null;
};

export type ParseResult = { ok: true; dicom: ParsedDicom } | { ok: false; reason: string };

const SR_SOP_CLASS_PREFIX = '1.2.840.10008.5.1.4.1.1.88.';
const PIXEL_DATA_TAG = '7FE00010';

export function isDicomPart10(bytes: Uint8Array): boolean {
	return (
		bytes.length > 132 &&
		bytes[128] === 0x44 &&
		bytes[129] === 0x49 &&
		bytes[130] === 0x43 &&
		bytes[131] === 0x4d
	);
}

function numbers(value: unknown): number[] | undefined {
	const list = (Array.isArray(value) ? value : [value]).map(Number);
	return value !== undefined && list.every(Number.isFinite) ? list : undefined;
}

function integer(value: unknown): number | undefined {
	const n = Number(Array.isArray(value) ? value[0] : value);
	return value !== undefined && value !== '' && Number.isFinite(n) ? n : undefined;
}

/** Parses a DICOM Part 10 file header (everything before the pixel data). */
export function parseDicom(bytes: Uint8Array): ParseResult {
	if (!isDicomPart10(bytes)) return { ok: false, reason: 'not a DICOM file' };

	let dataset: Record<string, unknown>;
	try {
		const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
		const file = dcmjs.data.DicomMessage.readFile(buffer as ArrayBuffer, {
			ignoreErrors: true,
			untilTag: PIXEL_DATA_TAG,
			includeUntilTagValue: false
		});
		dataset = dcmjs.data.DicomMetaDictionary.naturalizeDataset(file.dict);
	} catch {
		return { ok: false, reason: 'unreadable DICOM file' };
	}

	const sopInstanceUid = asString(dataset.SOPInstanceUID);
	const sopClassUid = asString(dataset.SOPClassUID);
	const seriesInstanceUid = asString(dataset.SeriesInstanceUID);
	if (!sopInstanceUid || !sopClassUid || !seriesInstanceUid) {
		return { ok: false, reason: 'missing SOP or series identifiers' };
	}

	const isSr = sopClassUid.startsWith(SR_SOP_CLASS_PREFIX);
	const rows = integer(dataset.Rows);
	const columns = integer(dataset.Columns);
	if (!isSr && (!rows || !columns)) return { ok: false, reason: 'no image or report content' };

	return {
		ok: true,
		dicom: {
			kind: isSr ? 'sr' : 'image',
			sopInstanceUid,
			sopClassUid,
			seriesInstanceUid,
			studyInstanceUid: asString(dataset.StudyInstanceUID) ?? null,
			studyDate: asString(dataset.StudyDate) ?? null,
			studyDescription: asString(dataset.StudyDescription) ?? null,
			seriesDescription: asString(dataset.SeriesDescription) ?? null,
			seriesNumber: integer(dataset.SeriesNumber) ?? null,
			modality: asString(dataset.Modality) ?? null,
			geometry: {
				position: numbers(dataset.ImagePositionPatient),
				orientation: numbers(dataset.ImageOrientationPatient),
				rows,
				columns,
				frames: integer(dataset.NumberOfFrames) ?? 1,
				instanceNumber: integer(dataset.InstanceNumber)
			},
			sr: isSr ? extractSrDocument(dataset) : null
		}
	};
}
