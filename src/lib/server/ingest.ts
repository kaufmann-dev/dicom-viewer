import { createHash, randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { instance, item } from '#lib/server/db/schema.js';
import { layoutSeries } from '#lib/server/dicom/geometry.js';
import { parseDicom } from '#lib/server/dicom/parse.js';
import { isStl, stlLabel } from '#lib/server/stl.js';
import { itemDir, removeStored, writeStoredFile } from '#lib/server/storage.js';

export type IngestResult =
	| { status: 'added' | 'duplicate'; kind: 'image' | 'sr' | 'stl' }
	| { status: 'skipped'; reason: string };

async function instanceExists(projectId: string, sopInstanceUid: string): Promise<boolean> {
	const [row] = await db
		.select({ id: instance.id })
		.from(instance)
		.where(and(eq(instance.projectId, projectId), eq(instance.sopInstanceUid, sopInstanceUid)))
		.limit(1);
	return Boolean(row);
}

/** Stores the file and its instance row; returns false when another upload already stored it. */
async function storeInstance(
	values: Omit<typeof instance.$inferInsert, 'id' | 'path' | 'size'>,
	extension: string,
	bytes: Uint8Array
): Promise<boolean> {
	const id = randomUUID();
	const path = `${itemDir(values.projectId, values.itemId)}/${id}.${extension}`;
	const [inserted] = await db
		.insert(instance)
		.values({ ...values, id, path, size: bytes.length })
		.onConflictDoNothing({ target: [instance.projectId, instance.sopInstanceUid] })
		.returning({ id: instance.id });
	if (!inserted) return false;
	try {
		await writeStoredFile(path, bytes);
	} catch (error) {
		await db.delete(instance).where(eq(instance.id, id));
		await removeStored(path);
		throw error;
	}
	return true;
}

async function ingestStl(
	projectId: string,
	filename: string,
	bytes: Uint8Array
): Promise<IngestResult> {
	const sopInstanceUid = `stl:${createHash('sha256').update(bytes).digest('hex')}`;
	if (await instanceExists(projectId, sopInstanceUid)) return { status: 'duplicate', kind: 'stl' };

	const [created] = await db
		.insert(item)
		.values({
			projectId,
			kind: 'stl',
			label: stlLabel(filename),
			modality: 'STL',
			instanceCount: 1
		})
		.returning({ id: item.id });
	const stored = await storeInstance(
		{ projectId, itemId: created.id, sopInstanceUid },
		'stl',
		bytes
	);
	if (!stored) {
		await db.delete(item).where(eq(item.id, created.id));
		return { status: 'duplicate', kind: 'stl' };
	}
	return { status: 'added', kind: 'stl' };
}

async function seriesItemId(
	projectId: string,
	values: Omit<typeof item.$inferInsert, 'projectId'> & { seriesInstanceUid: string }
): Promise<string> {
	const [created] = await db
		.insert(item)
		.values({ ...values, projectId })
		.onConflictDoNothing({ target: [item.projectId, item.seriesInstanceUid] })
		.returning({ id: item.id });
	if (created) return created.id;
	const [existing] = await db
		.select({ id: item.id })
		.from(item)
		.where(
			and(eq(item.projectId, projectId), eq(item.seriesInstanceUid, values.seriesInstanceUid))
		);
	return existing.id;
}

/** Adds one uploaded file (DICOM instance or STL mesh) to a project. */
export async function ingestFile(
	projectId: string,
	filename: string,
	bytes: Uint8Array
): Promise<IngestResult> {
	if (/\.stl$/i.test(filename)) {
		return isStl(bytes)
			? ingestStl(projectId, filename, bytes)
			: { status: 'skipped', reason: 'invalid STL file' };
	}

	const parsed = parseDicom(bytes);
	if (!parsed.ok) return { status: 'skipped', reason: parsed.reason };
	const dicom = parsed.dicom;
	if (await instanceExists(projectId, dicom.sopInstanceUid)) {
		return { status: 'duplicate', kind: dicom.kind };
	}

	const itemId = await seriesItemId(projectId, {
		kind: dicom.kind,
		label:
			dicom.seriesDescription ??
			dicom.sr?.title ??
			`${dicom.modality ?? 'Series'} ${dicom.seriesNumber ?? ''}`.trim(),
		modality: dicom.modality,
		sopClassUid: dicom.sopClassUid,
		studyInstanceUid: dicom.studyInstanceUid,
		studyDate: dicom.studyDate,
		studyDescription: dicom.studyDescription,
		seriesInstanceUid: dicom.seriesInstanceUid,
		seriesNumber: dicom.seriesNumber
	});

	const stored = await storeInstance(
		{
			projectId,
			itemId,
			sopInstanceUid: dicom.sopInstanceUid,
			geometry: dicom.geometry,
			srContent: dicom.sr
		},
		'dcm',
		bytes
	);
	return { status: stored ? 'added' : 'duplicate', kind: dicom.kind };
}

/** Recomputes instance order, instance counts and volume eligibility after an upload. */
export async function finalizeProject(projectId: string): Promise<void> {
	const items = await db
		.select({ id: item.id, kind: item.kind })
		.from(item)
		.where(eq(item.projectId, projectId));

	for (const { id, kind } of items) {
		const instances = await db
			.select({ id: instance.id, geometry: instance.geometry })
			.from(instance)
			.where(eq(instance.itemId, id));

		if (instances.length === 0) {
			await db.delete(item).where(eq(item.id, id));
			await removeStored(itemDir(projectId, id));
			continue;
		}

		const layout = layoutSeries(instances);
		await db.transaction(async (tx) => {
			await tx
				.update(item)
				.set({ instanceCount: instances.length, volume: kind === 'image' && layout.volume })
				.where(eq(item.id, id));
			if (kind === 'stl') return;
			const rows = [...layout.sortKeys].map(
				([instanceId, key]) => sql`(${instanceId}::uuid, ${key}::double precision)`
			);
			await tx.execute(sql`
				update ${instance} set sort_key = v.key
				from (values ${sql.join(rows, sql`, `)}) as v(id, key)
				where ${instance.id} = v.id
			`);
		});
	}
}
