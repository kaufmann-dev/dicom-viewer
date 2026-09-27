declare module 'dcmjs' {
	export type DicomElement = { vr: string; Value?: unknown[]; InlineBinary?: string };
	export type DicomDataset = Record<string, DicomElement>;
	export type NaturalizedDataset = Record<string, unknown>;
	export class DicomDict {
		meta: DicomDataset;
		dict: DicomDataset;
		constructor(meta: DicomDataset);
		write(options?: { allowInvalidVRLength?: boolean; fragmentMultiframe?: boolean }): ArrayBuffer;
	}
	export const data: {
		DicomMessage: {
			readFile(
				buffer: ArrayBuffer,
				options?: {
					ignoreErrors?: boolean;
					untilTag?: string | null;
					includeUntilTagValue?: boolean;
					noCopy?: boolean;
				}
			): DicomDict;
		};
		DicomMetaDictionary: {
			naturalizeDataset(dataset: DicomDataset): NaturalizedDataset;
			denaturalizeDataset(dataset: NaturalizedDataset): DicomDataset;
		};
		DicomDict: typeof DicomDict;
	};
	const dcmjs: { data: typeof data };
	export default dcmjs;
}
