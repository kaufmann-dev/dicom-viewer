import { and, asc, eq, inArray, type SQL } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { item, passcodeItem, project } from '$lib/server/db/schema';
import type { CatalogItem, CatalogProject } from '$lib/catalog';

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

/** Groups items by project and study; STL items form their own "3D models" group. */
export function groupCatalog(
	rows: (CatalogItem & {
		projectId: string;
		projectName: string;
		studyInstanceUid: string | null;
		studyDate: string | null;
		studyDescription: string | null;
	})[]
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
			seriesNumber: row.seriesNumber
		});
	}
	for (const p of projects.values()) {
		p.studies.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
	}
	return [...projects.values()];
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
		.where(accessFilter(locals))
		.orderBy(asc(project.name), asc(item.seriesNumber), asc(item.label));
	return groupCatalog(rows);
}
