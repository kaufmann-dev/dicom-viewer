export type CatalogItem = {
	id: string;
	kind: 'image' | 'sr' | 'stl';
	label: string;
	modality: string | null;
	sopClassUid: string | null;
	instanceCount: number;
	volume: boolean;
	seriesNumber: number | null;
};

export type CatalogStudy = {
	key: string;
	date: string | null;
	description: string | null;
	items: CatalogItem[];
};

export type CatalogProject = { id: string; name: string; studies: CatalogStudy[] };
