export type ByteRange = { start: number; end: number };

/**
 * Reads a single `bytes=start-end` or `bytes=start-` range. Returns null when the whole file should
 * be sent (no header, or a form this server does not serve), and 'unsatisfiable' when the range
 * starts beyond the file.
 */
export function parseRange(
	header: string | null,
	size: number
): ByteRange | null | 'unsatisfiable' {
	const match = header && /^bytes=(\d+)-(\d*)$/.exec(header.trim());
	if (!match) return null;
	const start = Number(match[1]);
	const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
	if (start >= size || end < start) return 'unsatisfiable';
	return { start, end };
}
