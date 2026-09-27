/** One stored file selected for download, with the metadata that names it in the archive. */
export type DownloadRow = {
	projectName: string;
	itemId: string;
	kind: 'image' | 'sr' | 'stl';
	label: string;
	seriesNumber: number | null;
	studyInstanceUid: string | null;
	studyDate: string | null;
	studyDescription: string | null;
	createdAt: Date;
	path: string;
	size: number;
};

export type ArchiveEntry = { name: string; path: string; size: number; lastModified: Date };

// eslint-disable-next-line no-control-regex
const UNSAFE = /[<>:"/\\|?*\u0000-\u001f\u007f]/g;

/** A file or folder name that is valid on Windows, macOS and Linux. */
export function safeName(text: string | null | undefined, fallback: string): string {
	const name = (text ?? '')
		.replace(/\s+/g, ' ')
		.replace(UNSAFE, '_')
		.trim()
		.slice(0, 80)
		.replace(/[. ]+$/, '');
	return name || fallback;
}

/** Formats a DICOM date (YYYYMMDD) as YYYY-MM-DD, which sorts chronologically. */
export function isoDate(value: string | null): string {
	const m = value ? /^(\d{4})(\d{2})(\d{2})/.exec(value) : null;
	return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

/** Gives each key a name unique within its folder, adding " (2)", " (3)" … on collisions. */
function uniqueNamer() {
	const assigned = new Map<string, string>();
	const used = new Set<string>();
	return (folder: string, key: string, base: string, extension = ''): string => {
		const id = `${folder}\n${key}`;
		let name = assigned.get(id);
		if (name) return name;
		name = base + extension;
		// Case-insensitive, since Windows and macOS file systems are.
		for (let n = 2; used.has(`${folder}/${name}`.toLowerCase()); n++) {
			name = `${base} (${n})${extension}`;
		}
		used.add(`${folder}/${name}`.toLowerCase());
		assigned.set(id, name);
		return name;
	};
}

function studyFolder(row: DownloadRow): string {
	if (row.kind === 'stl') return '3D models';
	const text = [isoDate(row.studyDate), row.studyDescription].filter(Boolean).join(' ');
	return safeName(text, 'Unknown study');
}

function seriesFolder(row: DownloadRow): string {
	const number = row.seriesNumber === null ? '' : String(row.seriesNumber).padStart(3, '0');
	return safeName([number, row.label].filter(Boolean).join(' '), 'Series');
}

/**
 * Lays out rows as Project/Study/Series/IM00001.dcm, numbering instances in row order, with STL
 * models under Project/3D models. Rows of one item must be consecutive and in slice order.
 */
export function archiveEntries(rows: DownloadRow[]): ArchiveEntry[] {
	const name = uniqueNamer();
	const counts = new Map<string, number>();
	return rows.map((row) => {
		const root = safeName(row.projectName, 'Project');
		const studyKey = row.kind === 'stl' ? 'stl' : (row.studyInstanceUid ?? 'unknown');
		const dir = `${root}/${name(root, studyKey, studyFolder(row))}`;
		const entry = { path: row.path, size: row.size, lastModified: row.createdAt };
		if (row.kind === 'stl') {
			return {
				...entry,
				name: `${dir}/${name(dir, row.itemId, safeName(row.label, 'Model'), '.stl')}`
			};
		}
		const series = name(dir, row.itemId, seriesFolder(row));
		const index = (counts.get(row.itemId) ?? 0) + 1;
		counts.set(row.itemId, index);
		return { ...entry, name: `${dir}/${series}/IM${String(index).padStart(5, '0')}.dcm` };
	});
}

/** Joins the non-empty parts into a download filename. */
export function downloadFilename(parts: (string | null)[], extension: string): string {
	const base = parts
		.map((part) => safeName(part, ''))
		.filter(Boolean)
		.join(' - ');
	return `${base || 'Download'}${extension}`;
}

/** Content-Disposition with an ASCII fallback and the UTF-8 name (RFC 6266). */
export function contentDisposition(filename: string): string {
	const ascii = filename.replace(/[^\x20-\x7e]|["\\]/g, '_');
	const encoded = encodeURIComponent(filename).replace(
		/['()*]/g,
		(c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
	);
	return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
