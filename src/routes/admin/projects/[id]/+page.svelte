<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import CheckIcon from '@lucide/svelte/icons/check';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import XIcon from '@lucide/svelte/icons/x';
	import ConfirmDelete from '#lib/components/admin/confirm-delete.svelte';
	import UploadPanel from '#lib/components/admin/upload-panel.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { downloadHref } from '#lib/download.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { itemTypeText } from '#lib/item-kind.js';
	import { formatDicomDate } from '#lib/sr.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let renamingProject = $state(false);
	let editingItem: string | null = $state(null);
</script>

<svelte:head><title>{data.project.name} · Scans</title></svelte:head>

<Button variant="ghost" size="sm" href={resolve('admin/projects')} class="-ml-2"
	><ArrowLeftIcon />Projects</Button
>

<div class="mt-4 flex items-center gap-2">
	{#if renamingProject}
		<form
			method="POST"
			action="?/rename"
			class="flex flex-1 gap-2"
			use:enhance={() =>
				async ({ update }) => {
					await update({ reset: false });
					renamingProject = false;
				}}
		>
			<Input name="name" value={data.project.name} aria-label="Project name" required />
			<Button type="submit" size="icon" aria-label="Save name"><CheckIcon /></Button>
			<Button
				variant="ghost"
				size="icon"
				aria-label="Cancel renaming"
				onclick={() => (renamingProject = false)}><XIcon /></Button
			>
		</form>
	{:else}
		<h1 class="min-w-0 truncate text-2xl font-semibold tracking-tight">{data.project.name}</h1>
		<Button
			variant="ghost"
			size="icon-sm"
			aria-label="Rename project"
			onclick={() => (renamingProject = true)}><PencilIcon /></Button
		>

		<span class="flex-1"></span>
		{#if data.items.length}
			<Button variant="outline" href={downloadHref({ project: data.project.id })} download>
				<DownloadIcon />Download
			</Button>
		{/if}
		<ConfirmDelete
			action="?/delete"
			id={data.project.id}
			title="Delete project?"
			description="All uploaded files of “{data.project
				.name}” are deleted and removed from every passcode."
			label="Delete project"
		/>
	{/if}
</div>
{#if form?.message}
	<p class="mt-2 text-sm text-destructive" role="alert">{form.message}</p>
{/if}

<div class="mt-6">
	<UploadPanel projectId={data.project.id} />
</div>

<h2 class="mt-10 text-lg font-semibold">Items</h2>
{#if data.items.length === 0}
	<p class="mt-2 text-sm text-muted-foreground">Nothing uploaded yet.</p>
{:else}
	<Table.Root class="mt-2">
		<Table.Header>
			<Table.Row>
				<Table.Head>Label</Table.Head>
				<Table.Head>Type</Table.Head>
				<Table.Head>Study date</Table.Head>
				<Table.Head class="text-right">Images</Table.Head>
				<Table.Head><span class="sr-only">Actions</span></Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each data.items as item (item.id)}
				<Table.Row>
					<Table.Cell class="w-full max-w-0">
						{#if editingItem === item.id}
							<form
								method="POST"
								action="?/renameItem"
								class="flex gap-2"
								use:enhance={() =>
									async ({ update }) => {
										await update({ reset: false });
										editingItem = null;
									}}
							>
								<input type="hidden" name="id" value={item.id} />
								<Input name="label" value={item.label} aria-label="Item label" required />
								<Button type="submit" size="icon" aria-label="Save label"><CheckIcon /></Button>
								<Button
									variant="ghost"
									size="icon"
									aria-label="Cancel renaming"
									onclick={() => (editingItem = null)}><XIcon /></Button
								>
							</form>
						{:else}
							<a
								class="block truncate hover:underline"
								href={resolve('/view/[itemId]', { itemId: item.id })}>{item.label}</a
							>
						{/if}
					</Table.Cell>
					<Table.Cell class="whitespace-nowrap">
						{itemTypeText(item)}
					</Table.Cell>
					<Table.Cell class="whitespace-nowrap">{formatDicomDate(item.studyDate)}</Table.Cell>
					<Table.Cell class="text-right tabular-nums">{item.instanceCount}</Table.Cell>
					<Table.Cell>
						<div class="flex justify-end gap-1">
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Rename {item.label}"
								onclick={() => (editingItem = item.id)}><PencilIcon /></Button
							>

							<ConfirmDelete
								action="?/deleteItem"
								id={item.id}
								title="Delete item?"
								description="“{item.label}” is deleted and removed from every passcode."
								label="Delete {item.label}"
							/>
						</div>
					</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
{/if}
