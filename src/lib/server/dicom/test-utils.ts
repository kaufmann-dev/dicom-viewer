import dcmjs from 'dcmjs';

/** Writes a minimal synthetic DICOM Part 10 file from a naturalized dataset. */
export function writeDicom(dataset: Record<string, unknown>): Uint8Array {
	const { DicomMetaDictionary, DicomDict } = dcmjs.data;
	const meta = DicomMetaDictionary.denaturalizeDataset({
		FileMetaInformationVersion: new Uint8Array([0, 1]).buffer,
		MediaStorageSOPClassUID: dataset.SOPClassUID,
		MediaStorageSOPInstanceUID: dataset.SOPInstanceUID,
		TransferSyntaxUID: '1.2.840.10008.1.2.1',
		ImplementationClassUID: '1.2.3.4'
	});
	const dict = new DicomDict(meta);
	dict.dict = DicomMetaDictionary.denaturalizeDataset(dataset);
	return new Uint8Array(dict.write());
}

export function ctSlice(index: number, overrides: Record<string, unknown> = {}) {
	return {
		SOPClassUID: '1.2.840.10008.5.1.4.1.1.2',
		SOPInstanceUID: `1.2.3.4.5.${index}`,
		StudyInstanceUID: '1.2.3.4',
		SeriesInstanceUID: '1.2.3.4.5',
		StudyDate: '20240101',
		StudyDescription: 'Head',
		SeriesDescription: 'Axial 1.0',
		SeriesNumber: 3,
		Modality: 'CT',
		InstanceNumber: index + 1,
		Rows: 2,
		Columns: 2,
		ImagePositionPatient: [0, 0, index * 1.5],
		ImageOrientationPatient: [1, 0, 0, 0, 1, 0],
		...overrides
	};
}
