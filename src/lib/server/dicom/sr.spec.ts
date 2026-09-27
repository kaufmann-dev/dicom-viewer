import { describe, expect, it } from 'vitest';
import { extractSrDocument } from './sr';

const code = (meaning: string) => [
	{ CodeValue: 'x', CodingSchemeDesignator: 'x', CodeMeaning: meaning }
];

describe('extractSrDocument', () => {
	it('renders a text report with header fields', () => {
		const doc = extractSrDocument({
			ConceptNameCodeSequence: code('Radiology report'),
			ContentDate: '20240606',
			ContentTime: '101500',
			CompletionFlag: 'COMPLETE',
			VerificationFlag: 'VERIFIED',
			VerifyingObserverSequence: [{ VerifyingObserverName: { Alphabetic: 'Doe^Jane' } }],
			ContentSequence: [
				{
					ValueType: 'CODE',
					ConceptNameCodeSequence: code('Language'),
					ConceptCodeSequence: code('German')
				},
				{
					ValueType: 'CONTAINER',
					ConceptNameCodeSequence: code('Findings'),
					ContentSequence: [
						{
							ValueType: 'TEXT',
							ConceptNameCodeSequence: code('Findings'),
							TextValue: 'Line 1\nLine 2'
						}
					]
				}
			]
		});
		expect(doc.title).toBe('Radiology report');
		expect(doc.header).toEqual([
			{ label: 'Content date', value: '2024-06-06 10:15:00' },
			{ label: 'Completion', value: 'COMPLETE' },
			{ label: 'Verification', value: 'VERIFIED' },
			{ label: 'Verified by', value: 'Doe Jane' }
		]);
		expect(doc.content[0]).toMatchObject({ name: 'Language', value: 'German' });
		expect(doc.content[1].children[0]).toMatchObject({
			valueType: 'TEXT',
			value: 'Line 1\nLine 2'
		});
	});

	it('renders dose measurements with units and hides references', () => {
		const doc = extractSrDocument({
			ConceptNameCodeSequence: code('X-Ray Radiation Dose Report'),
			ContentSequence: [
				{ ValueType: 'UIDREF', ConceptNameCodeSequence: code('Device UID'), UID: '1.2.3' },
				{
					ValueType: 'NUM',
					ConceptNameCodeSequence: code('Dose (RP) Total'),
					MeasuredValueSequence: [
						{ NumericValue: 0.000252, MeasurementUnitsCodeSequence: code('Gy') }
					]
				},
				{
					ValueType: 'NUM',
					ConceptNameCodeSequence: code('Exposure Index'),
					MeasuredValueSequence: [
						{ NumericValue: 348, MeasurementUnitsCodeSequence: code('no units') }
					]
				},
				{ ValueType: 'IMAGE', ConceptNameCodeSequence: code('Acquired Image') }
			]
		});
		expect(doc.content).toEqual([
			{ name: 'Dose (RP) Total', valueType: 'NUM', value: '0.000252', unit: 'Gy', children: [] },
			{ name: 'Exposure Index', valueType: 'NUM', value: '348', children: [] }
		]);
	});
});
