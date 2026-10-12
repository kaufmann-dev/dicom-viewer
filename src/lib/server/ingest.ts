import { createHash, randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { instance, item } from '#lib/server/db/schema.js';
import type { ItemKind } from '#lib/catalog.js';
import { layoutSeries } from '#lib/server/dicom/geometry.js';
import { isDicomPart10, parseDicom } from '#lib/server/dicom/parse.js';
import { detectPlainFile, fileLabel, pdfPath } from '#lib/server/file-types.js';
import { isStl } from '#lib/server/stl.js';
import { itemDir, removeStored, writeStoredFile } from '#lib/server/storage.js';

export type IngestResult =
	{ status: 'added' | 'duplicate'; kind: ItemKind } | { status: 'skipped'; reason: string };

type PlainKind = 'stl' | 'photo' | 'pdf';

const PLAIN_LABELS: Record<PlainKind, string> = { stl: 'Model', photo: 'Photo', pdf: 'Document' };

async function instanceExists(projectId: string, sopInstanceUid: string): Promise<boolean> {
	const [row] = await db
		.select({ id: instance.id })
		.from(instance)
		.where(and(eq(instance.projectId, projectId), eq(instance.sopInstanceUid, sopInstanceUid)))
		.limit(1);
	return Boolean(row);
}

/**
 * Stores the file and its instance row; returns false when another upload already stored it. An
 * extracted `pdf` is stored next to the file (see `pdfPath`).
 */
async function storeInstance(
	values: Omit<typeof instance.$inferInsert, 'id' | 'path' | 'size'>,
	extension: string,
	bytes: Uint8Array,
	pdf: Uint8Array | null = null
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
		if (pdf) await writeStoredFile(pdfPath(path), pdf);
	} catch (error) {
		await db.delete(instance).where(eq(instance.id, id));
		await removeStored(path);
		if (pdf) await removeStored(pdfPath(path));
		throw error;
	}
	return true;
}

/** Adds an STL model, photo or PDF file as an item of its own, deduplicated by content. */
async function ingestPlainFile(
	projectId: string,
	kind: PlainKind,
	filename: string,
	bytes: Uint8Array,
	extension: string
): Promise<IngestResult> {
	const sopInstanceUid = `${kind}:${createHash('sha256').update(bytes).digest('hex')}`;
	if (await instanceExists(projectId, sopInstanceUid)) return { status: 'duplicate', kind };

	const [created] = await db
		.insert(item)
		.values({
			projectId,
			kind,
			label: fileLabel(filename, PLAIN_LABELS[kind]),
			modality: kind === 'stl' ? 'STL' : null,
			instanceCount: 1
		})
		.returning({ id: item.id });
	const stored = await storeInstance(
		{ projectId, itemId: created.id, sopInstanceUid },
		extension,
		bytes
	);
	if (!stored) {
		await db.delete(item).where(eq(item.id, created.id));
		return { status: 'duplicate', kind };
	}
	return { status: 'added', kind };
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

/**
 * Adds one uploaded file (DICOM instance, STL mesh, photo or PDF) to a project. `filename` is the
 * path relative to the upload; photos and PDFs inside folders are skipped, because exported DICOM
 * folders and patient CDs carry viewer icons and manuals.
 */
export async function ingestFile(
	projectId: string,
	filename: string,
	bytes: Uint8Array
): Promise<IngestResult> {
	if (/\.stl$/i.test(filename)) {
		return isStl(bytes)
			? ingestPlainFile(projectId, 'stl', filename, bytes, 'stl')
			: { status: 'skipped', reason: 'invalid STL file' };
	}

	if (!isDicomPart10(bytes)) {
		const plain = detectPlainFile(bytes);
		if (!plain) return { status: 'skipped', reason: 'unsupported file type' };
		if (/[/\\]/.test(filename))
			return { status: 'skipped', reason: 'photo or PDF inside a folder' };
		return ingestPlainFile(projectId, plain.kind, filename, bytes, plain.extension);
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
			dicom.documentTitle ??
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
		bytes,
		dicom.pdf
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
			if (kind === 'stl' || kind === 'photo') return;
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
