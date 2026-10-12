import { describe, expect, it } from 'vitest';
import { parseDicom } from './parse';
import { ctSlice, writeDicom } from './test-utils';

function encapsulatedPdf(overrides: Record<string, unknown>) {
	return {
		SOPClassUID: '1.2.840.10008.5.1.4.1.1.104.1',
		SOPInstanceUID: '1.2.7',
		StudyInstanceUID: '1.2.3.4',
		SeriesInstanceUID: '1.2.7.1',
		Modality: 'DOC',
		MIMETypeOfEncapsulatedDocument: 'application/pdf',
		DocumentTitle: 'Referral',
		...overrides
	};
}

describe('parseDicom', () => {
	it('reads image identifiers and geometry', () => {
		const result = parseDicom(writeDicom(ctSlice(2)));
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.dicom).toMatchObject({
			kind: 'image',
			sopInstanceUid: '1.2.3.4.5.2',
			seriesInstanceUid: '1.2.3.4.5',
			modality: 'CT',
			seriesDescription: 'Axial 1.0',
			seriesNumber: 3,
			studyDate: '20240101',
			geometry: {
				position: [0, 0, 3],
				orientation: [1, 0, 0, 0, 1, 0],
				rows: 2,
				columns: 2,
				frames: 1,
				instanceNumber: 3
			}
		});
	});

	it('classifies structured reports and extracts their content', () => {
		const result = parseDicom(
			writeDicom({
				SOPClassUID: '1.2.840.10008.5.1.4.1.1.88.11',
				SOPInstanceUID: '1.2.9',
				SeriesInstanceUID: '1.2.9.1',
				Modality: 'SR',
				ValueType: 'CONTAINER',
				ConceptNameCodeSequence: [
					{ CodeValue: '1', CodingSchemeDesignator: 'L', CodeMeaning: 'Report' }
				],
				ContentSequence: [
					{
						RelationshipType: 'CONTAINS',
						ValueType: 'TEXT',
						ConceptNameCodeSequence: [
							{ CodeValue: '2', CodingSchemeDesignator: 'L', CodeMeaning: 'Findings' }
						],
						TextValue: 'No fracture.'
					}
				]
			})
		);
		expect(result.ok && result.dicom.kind).toBe('sr');
		expect(result.ok && result.dicom.sr?.content[0]).toMatchObject({
			name: 'Findings',
			value: 'No fracture.'
		});
	});

	it('extracts the document of an Encapsulated PDF', () => {
		const pdf = new TextEncoder().encode('%PDF-1.4\n%%EOF\n\n');
		const result = parseDicom(writeDicom(encapsulatedPdf({ EncapsulatedDocument: [pdf.buffer] })));
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.dicom).toMatchObject({ kind: 'pdf', documentTitle: 'Referral', modality: 'DOC' });
		expect(result.dicom.pdf).toEqual(pdf);
	});

	it('skips encapsulated documents that are not PDFs', () => {
		const pdf = new TextEncoder().encode('%PDF-1.4\n%%EOF\n\n');
		const cda = encapsulatedPdf({
			MIMETypeOfEncapsulatedDocument: 'text/XML',
			EncapsulatedDocument: [pdf.buffer]
		});
		const empty = encapsulatedPdf({
			EncapsulatedDocument: [new TextEncoder().encode('not a pdf!').buffer]
		});
		expect(parseDicom(writeDicom(cda)).ok).toBe(false);
		expect(parseDicom(writeDicom(empty))).toEqual({
			ok: false,
			reason: 'empty encapsulated document'
		});
	});

	it('rejects files that are not DICOM', () => {
		expect(parseDicom(new TextEncoder().encode('hello'))).toEqual({
			ok: false,
			reason: 'not a DICOM file'
		});
	});

	it('rejects DICOM objects without image or report content', () => {
		const result = parseDicom(
			writeDicom({
				SOPClassUID: '1.2.840.10008.5.1.4.1.1.11.1',
				SOPInstanceUID: '1.2.8',
				SeriesInstanceUID: '1.2.8.1'
			})
		);
		expect(result.ok).toBe(false);
	});
});
