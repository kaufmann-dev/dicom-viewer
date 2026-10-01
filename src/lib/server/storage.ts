import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from '$app/env/private';

function dataDir(): string {
	if (!DATA_DIR) throw new Error('DATA_DIR is not set');
	return path.resolve(DATA_DIR);
}

/** Resolves a stored relative path, refusing anything outside DATA_DIR. */
export function resolveStoredPath(relativePath: string): string {
	const root = dataDir();
	const absolute = path.resolve(root, relativePath);
	if (!absolute.startsWith(root + path.sep)) throw new Error('Path escapes DATA_DIR');
	return absolute;
}

export function projectDir(projectId: string): string {
	return `projects/${projectId}`;
}

export function itemDir(projectId: string, itemId: string): string {
	return `${projectDir(projectId)}/${itemId}`;
}

export async function writeStoredFile(relativePath: string, bytes: Uint8Array): Promise<void> {
	const target = resolveStoredPath(relativePath);
	await mkdir(path.dirname(target), { recursive: true });
	const temp = `${target}.${randomUUID()}.tmp`;
	await writeFile(temp, bytes);
	await rename(temp, target);
}

export async function removeStored(relativePath: string): Promise<void> {
	await rm(resolveStoredPath(relativePath), { recursive: true, force: true });
}
