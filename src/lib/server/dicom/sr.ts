import type { SrDocument, SrNode } from '$lib/sr';
import { formatDicomDate, formatDicomDateTime, formatDicomTime } from '$lib/sr';

type Dataset = Record<string, unknown>;

/** Content items that only reference other objects and carry nothing readable. */
const HIDDEN_VALUE_TYPES = new Set([
	'UIDREF',
	'IMAGE',
	'COMPOSITE',
	'WAVEFORM',
	'SCOORD',
	'SCOORD3D',
	'TCOORD'
]);

export function asArray(value: unknown): Dataset[] {
	if (Array.isArray(value)) return value as Dataset[];
	return value && typeof value === 'object' ? [value as Dataset] : [];
}

export function asString(value: unknown): string | undefined {
	if (value === undefined || value === null) return undefined;
	if (Array.isArray(value))
		return value.length ? value.map((v) => asString(v)).join('\\') : undefined;
	if (typeof value === 'object') {
		const name = (value as { Alphabetic?: unknown }).Alphabetic;
		return name === undefined ? undefined : asString(name);
	}
	const text = String(value).trim();
	return text || undefined;
}

function codeMeaning(sequence: unknown): string | undefined {
	const code = asArray(sequence)[0];
	return code ? (asString(code.CodeMeaning) ?? asString(code.CodeValue)) : undefined;
}

function personName(value: unknown): string | undefined {
	return asString(value)?.replaceAll('^', ' ').trim();
}

function toNode(item: Dataset): SrNode | null {
	const valueType = asString(item.ValueType) ?? 'UNKNOWN';
	if (HIDDEN_VALUE_TYPES.has(valueType)) return null;

	const node: SrNode = {
		name: codeMeaning(item.ConceptNameCodeSequence) ?? '',
		valueType,
		children: toNodes(item.ContentSequence)
	};

	switch (valueType) {
		case 'TEXT':
			node.value = asString(item.TextValue);
			break;
		case 'NUM': {
			const measured = asArray(item.MeasuredValueSequence)[0];
			node.value = measured ? asString(measured.NumericValue) : undefined;
			const unit = measured ? codeMeaning(measured.MeasurementUnitsCodeSequence) : undefined;
			if (unit && unit !== 'no units') node.unit = unit;
			break;
		}
		case 'CODE':
			node.value = codeMeaning(item.ConceptCodeSequence);
			break;
		case 'DATETIME':
			node.value = formatDicomDateTime(asString(item.DateTime));
			break;
		case 'DATE':
			node.value = formatDicomDate(asString(item.Date));
			break;
		case 'TIME':
			node.value = formatDicomTime(asString(item.Time));
			break;
		case 'PNAME':
			node.value = personName(item.PersonName);
			break;
	}

	if (valueType !== 'CONTAINER' && !node.value && node.children.length === 0) return null;
	return node;
}

function toNodes(sequence: unknown): SrNode[] {
	return asArray(sequence)
		.map(toNode)
		.filter((n): n is SrNode => n !== null);
}

/** Extracts a readable tree from a naturalized DICOM SR dataset (text reports and dose reports). */
export function extractSrDocument(dataset: Dataset): SrDocument {
	const header: SrDocument['header'] = [];
	const add = (label: string, value: string | undefined) => {
		if (value) header.push({ label, value });
	};

	const contentDate = formatDicomDate(asString(dataset.ContentDate));
	const contentTime = formatDicomTime(asString(dataset.ContentTime));
	add('Content date', [contentDate, contentTime].filter(Boolean).join(' '));
	add('Completion', asString(dataset.CompletionFlag));
	add('Verification', asString(dataset.VerificationFlag));
	for (const observer of asArray(dataset.VerifyingObserverSequence)) {
		add('Verified by', personName(observer.VerifyingObserverName));
	}
	add('Institution', asString(dataset.InstitutionName));

	return {
		title:
			codeMeaning(dataset.ConceptNameCodeSequence) ??
			asString(dataset.SeriesDescription) ??
			'Report',
		header,
		content: toNodes(dataset.ContentSequence)
	};
}
