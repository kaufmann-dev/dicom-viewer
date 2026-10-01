import { resolve } from '$app/paths';

/** Link to the download endpoint: one item, a whole project, or one study of a project. */
export function downloadHref(
	query: { item: string } | { project: string; study?: string }
): string {
	return `${resolve('api/files/download')}?${new URLSearchParams(query)}`;
}
