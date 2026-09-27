import { and, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { instance, item, passcodeItem, project } from '$lib/server/db/schema';
import { itemOrder, type CatalogItem, type CatalogProject } from '$lib/catalog';

function viewerItemIds(passcodeId: string) {
	return db
		.select({ id: passcodeItem.itemId })
		.from(passcodeItem)
		.where(eq(passcodeItem.passcodeId, passcodeId));
}

function accessFilter(locals: App.Locals): SQL | undefined {
	if (locals.admin) return undefined;
	if (locals.viewer) return inArray(item.id, viewerItemIds(locals.viewer.passcodeId));
	return inArray(item.id, []);
}

export async function canAccessItem(locals: App.Locals, itemId: string): Promise<boolean> {
	const [row] = await db
		.select({ id: item.id })
		.from(item)
		.where(and(eq(item.id, itemId), accessFilter(locals)));
	return Boolean(row);
}

type CatalogRow = Omit<CatalogItem, 'thumbnailInstanceId'> & {
	projectId: string;
	projectName: string;
	studyInstanceUid: string | null;
	studyDate: string | null;
	studyDescription: string | null;
};

/**
 * Groups items by project and study; STL items form their own "3D models" group. Studies are
 * newest first, and projects are ordered by their newest study.
 */
export function groupCatalog(
	rows: CatalogRow[],
	thumbnails: Map<string, string> = new Map()
): CatalogProject[] {
	const projects = new Map<string, CatalogProject>();
	for (const row of rows) {
		let p = projects.get(row.projectId);
		if (!p) {
			p = { id: row.projectId, name: row.projectName, studies: [] };
			projects.set(row.projectId, p);
		}
		const key = row.kind === 'stl' ? 'stl' : (row.studyInstanceUid ?? 'unknown');
		let study = p.studies.find((s) => s.key === key);
		if (!study) {
			study = {
				key,
				date: row.kind === 'stl' ? null : row.studyDate,
				description: row.kind === 'stl' ? '3D models' : row.studyDescription,
				items: []
			};
			p.studies.push(study);
		}
		study.items.push({
			id: row.id,
			kind: row.kind,
			label: row.label,
			modality: row.modality,
			sopClassUid: row.sopClassUid,
			instanceCount: row.instanceCount,
			volume: row.volume,
			seriesNumber: row.seriesNumber,
			thumbnailInstanceId: thumbnails.get(row.id) ?? null
		});
	}

	const latest = (p: CatalogProject) =>
		p.studies.reduce((max, s) => ((s.date ?? '') > max ? (s.date ?? '') : max), '');
	for (const p of projects.values()) {
		p.studies.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
		for (const s of p.studies) {
			s.items.sort(
				(a, b) =>
					itemOrder(a) - itemOrder(b) ||
					(a.seriesNumber ?? 0) - (b.seriesNumber ?? 0) ||
					a.label.localeCompare(b.label)
			);
		}
	}
	return [...projects.values()].sort(
		(a, b) => latest(b).localeCompare(latest(a)) || a.name.localeCompare(b.name)
	);
}

/** Middle instance (by slice order) of each image item. */
async function middleInstances(itemIds: string[]): Promise<Map<string, string>> {
	if (itemIds.length === 0) return new Map();
	const rows = await db.execute<{ item_id: string; id: string }>(sql`
		select item_id, id from (
			select ${instance.itemId} as item_id, ${instance.id} as id,
				row_number() over (partition by ${instance.itemId} order by ${instance.sortKey}) as position,
				count(*) over (partition by ${instance.itemId}) as total
			from ${instance}
			where ${inArray(instance.itemId, itemIds)}
		) ranked
		where position = total / 2 + 1
	`);
	return new Map(rows.map((r) => [r.item_id, r.id]));
}

/** All items visible to the current admin or viewer, grouped for display. */
export async function listCatalog(locals: App.Locals): Promise<CatalogProject[]> {
	const rows = await db
		.select({
			id: item.id,
			kind: item.kind,
			label: item.label,
			modality: item.modality,
			sopClassUid: item.sopClassUid,
			instanceCount: item.instanceCount,
			volume: item.volume,
			seriesNumber: item.seriesNumber,
			projectId: project.id,
			projectName: project.name,
			studyInstanceUid: item.studyInstanceUid,
			studyDate: item.studyDate,
			studyDescription: item.studyDescription
		})
		.from(item)
		.innerJoin(project, eq(project.id, item.projectId))
		.where(accessFilter(locals));
	const thumbnails = await middleInstances(rows.filter((r) => r.kind === 'image').map((r) => r.id));
	return groupCatalog(rows, thumbnails);
}
