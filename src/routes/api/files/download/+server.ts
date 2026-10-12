import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { error } from '@sveltejs/kit';
import { downloadZip, predictLength } from 'client-zip';
import { downloadRows, type DownloadFilter } from '#lib/server/access.js';
import { groupName, studyKey } from '#lib/catalog.js';
import {
	archiveEntries,
	contentDisposition,
	downloadFilename,
	isoDate,
	isPlainFile,
	type ArchiveEntry,
	type DownloadRow
} from '#lib/server/download.js';
import { contentTypeFor, storedExtension } from '#lib/server/file-types.js';
import { resolveStoredPath } from '#lib/server/storage.js';
import { idSchema } from '#lib/server/validation.js';
import type { RequestHandler } from './$types';

/** `?item=<id>`, `?project=<id>` or `?project=<id>&study=<StudyInstanceUID | stl | files>`. */
function parseFilter(params: URLSearchParams): DownloadFilter | null {
	const itemId = params.get('item');
	const projectId = params.get('project');
	const study = params.get('study');
	if (itemId !== null) {
		return projectId === null && study === null && idSchema.safeParse(itemId).success
			? { itemId }
			: null;
	}
	if (projectId === null || !idSchema.safeParse(projectId).success) return null;
	return study === null ? { projectId } : { projectId, study };
}

function fileStream(path: string): ReadableStream<Uint8Array> {
	return Readable.toWeb(createReadStream(resolveStoredPath(path))) as ReadableStream<Uint8Array>;
}

/** Opens each file only when the archive reaches it. */
async function* zipInputs(entries: ArchiveEntry[]) {
	for (const { name, path, size, lastModified } of entries) {
		yield { name, size, lastModified, input: fileStream(path) };
	}
}

function filenameParts(filter: DownloadFilter, first: DownloadRow): (string | null)[] {
	if ('itemId' in filter) return [first.projectName, isoDate(first.studyDate), first.label];
	if (filter.study === undefined) return [first.projectName];
	const group = groupName(studyKey(first));
	if (group) return [first.projectName, group];
	return [first.projectName, isoDate(first.studyDate) || first.studyDescription];
}

export const GET: RequestHandler = async ({ url, locals }) => {
	const filter = parseFilter(url.searchParams);
	if (!filter) error(404, 'Not found');
	const rows = await downloadRows(locals, filter);
	if (rows.length === 0) error(404, 'Not found');

	const first = rows[0];
	const parts = filenameParts(filter, first);
	// A single STL model, photo or PDF downloads as the file itself.
	if ('itemId' in filter && isPlainFile(first)) {
		return new Response(fileStream(first.path), {
			headers: {
				'content-type': contentTypeFor(first.path),
				'content-length': String(first.size),
				'content-disposition': contentDisposition(
					downloadFilename(parts, storedExtension(first.path))
				),
				'cache-control': 'private, no-store'
			}
		});
	}

	const entries = archiveEntries(rows);
	const length = predictLength(entries.map(({ name, size }) => ({ name, size })));
	const zip = downloadZip(zipInputs(entries), { length });
	return new Response(zip.body, {
		headers: {
			'content-type': 'application/zip',
			'content-length': String(length),
			'content-disposition': contentDisposition(downloadFilename(parts, '.zip')),
			'cache-control': 'private, no-store'
		}
	});
};
