import { DOSE_SR_SOP_CLASS } from '#lib/sr.js';

export function itemKindLabel(item: {
	kind: 'image' | 'sr' | 'stl';
	volume: boolean;
	sopClassUid: string | null;
	instanceCount: number;
}): string {
	if (item.kind === 'stl') return '3D model';
	if (item.kind === 'sr') return item.sopClassUid === DOSE_SR_SOP_CLASS ? 'Dose report' : 'Report';
	if (item.volume) return '3D volume';
	return item.instanceCount === 1 ? 'Image' : 'Image stack';
}

/** Kind and modality, e.g. "3D volume · CT". */
export function itemTypeText(
	item: Parameters<typeof itemKindLabel>[0] & { modality: string | null }
) {
	return [itemKindLabel(item), item.kind === 'stl' ? null : item.modality]
		.filter(Boolean)
		.join(' · ');
}
