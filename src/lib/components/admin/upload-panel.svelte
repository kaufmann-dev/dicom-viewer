<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import FilesIcon from '@lucide/svelte/icons/files';
	import FolderUpIcon from '@lucide/svelte/icons/folder-up';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Progress } from '#lib/components/ui/progress/index.js';
	import type { MissingThumbnail } from '#lib/catalog.js';

	let { projectId }: { projectId: string } = $props();

	type Upload = { file: File; name: string };
	type Tally = { added: number; duplicate: number; skipped: number; failed: number };

	const CONCURRENCY = 4;

	let folderInput: HTMLInputElement;
	let filesInput: HTMLInputElement;
	let dragging = $state(false);
	let running = $state(false);
	let total = $state(0);
	let done = $state(0);
	let tally: Tally = $state({ added: 0, duplicate: 0, skipped: 0, failed: 0 });
	let finished = $state(false);
	let failure = $state('');
	let previews: { done: number; total: number; failed: number } | null = $state(null);

	async function readEntry(entry: FileSystemEntry, out: Upload[]): Promise<void> {
		if (entry.isFile) {
			const file = await new Promise<File>((resolve, reject) =>
				(entry as FileSystemFileEntry).file(resolve, reject)
			);
			out.push({ file, name: entry.fullPath.replace(/^\//, '') });
			return;
		}
		const reader = (entry as FileSystemDirectoryEntry).createReader();
		// readEntries returns results in batches until it yields an empty array.
		for (;;) {
			const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
				reader.readEntries(resolve, reject)
			);
			if (batch.length === 0) break;
			for (const child of batch) await readEntry(child, out);
		}
	}

	async function upload(files: Upload[]) {
		const queue = files.filter((f) => !f.file.name.startsWith('.'));
		if (queue.length === 0 || running) return;
		running = true;
		finished = false;
		failure = '';
		total = queue.length;
		done = 0;
		tally = { added: 0, duplicate: 0, skipped: 0, failed: 0 };
		previews = null;

		let next = 0;
		async function worker() {
			while (next < queue.length) {
				const { file, name } = queue[next++];
				try {
					const response = await fetch(
						`/api/admin/projects/${projectId}/files?name=${encodeURIComponent(name)}`,
						{
							method: 'PUT',
							// Extensionless DICOM files have no MIME type; the body must stay raw bytes.
							headers: { 'content-type': 'application/octet-stream' },
							body: file
						}
					);
					if (!response.ok) throw new Error(`${response.status}`);
					const result: { status: keyof Tally } = await response.json();
					tally[result.status]++;
				} catch {
					tally.failed++;
				}
				done++;
			}
		}

		try {
			await Promise.all(Array.from({ length: CONCURRENCY }, worker));
			const response = await fetch(`/api/admin/projects/${projectId}/finalize`, { method: 'POST' });
			if (response.ok) {
				const { missingThumbnails }: { missingThumbnails: MissingThumbnail[] } =
					await response.json();
				await createPreviews(missingThumbnails);
			} else {
				failure = 'The upload finished, but the project could not be updated.';
			}
		} catch {
			failure = 'The connection was lost during the upload.';
		}
		await invalidateAll();
		running = false;
		finished = true;
	}

	/** Renders thumbnails here once and stores them, so viewers load them instead of rendering. */
	async function createPreviews(missing: MissingThumbnail[]) {
		if (missing.length === 0) return;
		previews = { done: 0, total: missing.length, failed: 0 };
		// The reactive proxy, so that progress updates render.
		const current = previews;
		const { loadThumbnail, releaseThumbnailData, storeThumbnail } =
			await import('#lib/viewer/thumbnails.js');
		// loadThumbnail renders a few at a time.
		await Promise.all(
			missing.map(async ({ instanceId, kind }) => {
				try {
					await storeThumbnail(instanceId, await loadThumbnail(instanceId, kind));
				} catch {
					current.failed++;
				}
				current.done++;
			})
		);
		releaseThumbnailData();
	}

	function fromInput(input: HTMLInputElement) {
		const files = [...(input.files ?? [])].map((file) => ({
			file,
			name: file.webkitRelativePath || file.name
		}));
		input.value = '';
		void upload(files);
	}

	async function onDrop(event: DragEvent) {
		event.preventDefault();
		dragging = false;
		const entries = [...(event.dataTransfer?.items ?? [])]
			.map((i) => i.webkitGetAsEntry())
			.filter((e): e is FileSystemEntry => e !== null);
		const files: Upload[] = [];
		for (const entry of entries) await readEntry(entry, files);
		void upload(files);
	}
</script>

<svelte:window
	onbeforeunload={(event) => {
		if (running) event.preventDefault();
	}}
/>

<section
	class={['border border-dashed p-6', dragging ? 'border-foreground bg-muted' : 'border-border']}
	aria-label="Upload"
	ondragover={(e) => {
		e.preventDefault();
		dragging = true;
	}}
	ondragleave={() => (dragging = false)}
	ondrop={onDrop}
>
	<p class="text-sm">
		Drop DICOM folders or STL files here, or choose them. DICOM files are recognized by content, so
		folders without file extensions work too.
	</p>
	<div class="mt-4 flex flex-wrap gap-2">
		<Button variant="outline" disabled={running} onclick={() => folderInput.click()}>
			<FolderUpIcon />Choose folder
		</Button>
		<Button variant="outline" disabled={running} onclick={() => filesInput.click()}>
			<FilesIcon />Choose files
		</Button>
	</div>
	<input
		bind:this={folderInput}
		type="file"
		class="hidden"
		webkitdirectory
		multiple
		onchange={() => fromInput(folderInput)}
	/>
	<input
		bind:this={filesInput}
		type="file"
		class="hidden"
		multiple
		onchange={() => fromInput(filesInput)}
	/>

	{#if running || finished}
		<div class="mt-6" role="status">
			<div class="flex justify-between text-sm">
				<span>
					{#if !running}Upload finished{:else if previews}Creating previews…{:else}Uploading…{/if}
				</span>
				<span class="tabular-nums">
					{#if running && previews}{previews.done} / {previews.total}{:else}{done} / {total}{/if}
				</span>
			</div>
			{#if running && previews}
				<Progress class="mt-2" value={previews.done} max={previews.total} />
			{:else}
				<Progress class="mt-2" value={done} max={total} />
			{/if}
			<p class="mt-2 text-xs text-muted-foreground">
				{tally.added} added · {tally.duplicate} already present · {tally.skipped} not DICOM or STL{#if tally.failed}
					· <span class="text-destructive">{tally.failed} failed</span>{/if}
			</p>
			{#if !running && previews?.failed}
				<p class="mt-2 text-xs text-muted-foreground">
					{previews.failed}
					{previews.failed === 1 ? 'preview' : 'previews'} could not be created. They are created when
					an admin opens the project.
				</p>
			{/if}
			{#if failure}<p class="mt-2 text-sm text-destructive" role="alert">{failure}</p>{/if}
		</div>
	{/if}
</section>
