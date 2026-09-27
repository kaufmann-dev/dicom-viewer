<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Table from '$lib/components/ui/table';
	import { formatBytes } from '$lib/format';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
</script>

<svelte:head><title>Projects · Scans</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Projects</h1>
<p class="mt-1 text-sm text-muted-foreground">
	A project holds uploaded DICOM folders and STL models.
</p>

<form method="POST" action="?/create" class="mt-6 flex max-w-lg gap-2" use:enhance>
	<Input name="name" placeholder="New project name" aria-label="New project name" required />
	<Button type="submit"><PlusIcon />Create</Button>
</form>
{#if form?.message}
	<p class="mt-2 text-sm text-destructive" role="alert">{form.message}</p>
{/if}

{#if data.projects.length === 0}
	<p class="mt-12 text-sm text-muted-foreground">No projects yet. Create one to upload files.</p>
{:else}
	<Table.Root class="mt-8">
		<Table.Header>
			<Table.Row>
				<Table.Head>Name</Table.Head>
				<Table.Head class="text-right">Items</Table.Head>
				<Table.Head class="text-right">Size</Table.Head>
				<Table.Head class="text-right">Created</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each data.projects as project (project.id)}
				<Table.Row>
					<Table.Cell class="w-full max-w-0">
						<a
							class="block truncate font-medium hover:underline"
							href={resolve('/admin/projects/[id]', { id: project.id })}
						>
							{project.name}
						</a>
					</Table.Cell>
					<Table.Cell class="text-right tabular-nums">{project.items}</Table.Cell>
					<Table.Cell class="text-right tabular-nums">{formatBytes(project.bytes)}</Table.Cell>
					<Table.Cell class="text-right">{dateFormat.format(project.createdAt)}</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
{/if}
