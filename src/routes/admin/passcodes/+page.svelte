<script lang="ts">
	import CopyIcon from '@lucide/svelte/icons/copy';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { toast } from 'svelte-sonner';
	import ConfirmDelete from '$lib/components/admin/confirm-delete.svelte';
	import PasscodeForm from '$lib/components/admin/passcode-form.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Sheet from '$lib/components/ui/sheet';
	import * as Table from '$lib/components/ui/table';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let open = $state(false);
	let editingId: string | null = $state(null);
	const editing = $derived(data.passcodes.find((p) => p.id === editingId) ?? null);

	const dateFormat = new Intl.DateTimeFormat(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short'
	});

	function edit(id: string | null) {
		editingId = id;
		open = true;
	}

	async function copy(text: string, what: string) {
		try {
			await navigator.clipboard.writeText(text);
			toast.success(`${what} copied`);
		} catch {
			toast.error('Copying is not available in this browser.');
		}
	}
</script>

<svelte:head><title>Passcodes · Scans</title></svelte:head>

<div class="flex flex-wrap items-end gap-4">
	<div class="mr-auto">
		<h1 class="text-2xl font-semibold tracking-tight">Passcodes</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			Each passcode opens only the items you select, until it expires.
		</p>
	</div>
	<Button variant="outline" onclick={() => copy(`${location.origin}/`, 'Link')}>
		<CopyIcon />Copy site link
	</Button>
	<Button onclick={() => edit(null)}><PlusIcon />New passcode</Button>
</div>

{#if data.passcodes.length === 0}
	<p class="mt-12 text-sm text-muted-foreground">
		No passcodes yet. Create one to share selected scans.
	</p>
{:else}
	<Table.Root class="mt-8">
		<Table.Header>
			<Table.Row>
				<Table.Head>Label</Table.Head>
				<Table.Head>Code</Table.Head>
				<Table.Head>Expires</Table.Head>
				<Table.Head class="text-right">Items</Table.Head>
				<Table.Head><span class="sr-only">Actions</span></Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each data.passcodes as passcode (passcode.id)}
				<Table.Row class={passcode.expired ? 'text-muted-foreground' : ''}>
					<Table.Cell class="w-full max-w-0"
						><span class="block truncate">{passcode.label}</span></Table.Cell
					>
					<Table.Cell>
						<div class="flex items-center gap-1">
							<code class="font-mono tracking-widest">{passcode.code}</code>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Copy code for {passcode.label}"
								onclick={() => copy(passcode.code, 'Code')}
							>
								<CopyIcon />
							</Button>
						</div>
					</Table.Cell>
					<Table.Cell class="whitespace-nowrap">
						{#if passcode.expired}<span class="font-medium">Expired</span> ·{/if}
						{dateFormat.format(passcode.expiresAt)}
					</Table.Cell>
					<Table.Cell class="text-right tabular-nums">{passcode.itemIds.length}</Table.Cell>
					<Table.Cell>
						<div class="flex justify-end gap-1">
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Edit {passcode.label}"
								onclick={() => edit(passcode.id)}
							>
								<PencilIcon />
							</Button>
							<ConfirmDelete
								action="?/delete"
								id={passcode.id}
								title="Delete passcode?"
								description="“{passcode.label}” stops working immediately, including for anyone signed in with it."
								label="Delete {passcode.label}"
							/>
						</div>
					</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
{/if}

<Sheet.Root bind:open>
	<Sheet.Content class="w-full gap-0 sm:max-w-lg">
		<Sheet.Header>
			<Sheet.Title>{editing ? 'Edit passcode' : 'New passcode'}</Sheet.Title>
			<Sheet.Description>
				{editing ? `Code ${editing.code}` : 'A random code is generated when you create it.'}
			</Sheet.Description>
		</Sheet.Header>
		{#key editingId}
			<PasscodeForm catalog={data.catalog} passcode={editing} onSaved={() => (open = false)} />
		{/key}
	</Sheet.Content>
</Sheet.Root>
