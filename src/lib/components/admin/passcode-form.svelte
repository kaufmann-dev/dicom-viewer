<script lang="ts">
	import { enhance } from '$app/forms';
	import { SvelteSet } from 'svelte/reactivity';
	import type { CatalogProject } from '#lib/catalog.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { itemKindLabel } from '#lib/item-kind.js';
	import { formatDicomDate } from '#lib/sr.js';

	let {
		catalog,
		passcode,
		onSaved
	}: {
		catalog: CatalogProject[];
		passcode: {
			id: string;
			label: string;
			code: string;
			expiresAt: Date;
			allowDownload: boolean;
			itemIds: string[];
		} | null;
		onSaved: () => void;
	} = $props();

	const DAY = 24 * 60 * 60 * 1000;

	function toLocalInput(date: Date): string {
		const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
		return local.toISOString().slice(0, 16);
	}

	// The form is created fresh for each passcode being edited, so the props are read once.
	const initial = (() => passcode)();
	let label = $state(initial?.label ?? '');
	let code = $state(initial?.code ?? '');
	let allowDownload = $state(initial?.allowDownload ?? false);
	let expiresLocal = $state(toLocalInput(initial?.expiresAt ?? new Date(Date.now() + 30 * DAY)));
	const selected = new SvelteSet<string>(initial?.itemIds ?? []);
	let error = $state('');
	let saving = $state(false);

	const expiresIso = $derived.by(() => {
		const date = new Date(expiresLocal);
		return Number.isNaN(date.getTime()) ? '' : date.toISOString();
	});
	const allIds = $derived(
		catalog.flatMap((p) => p.studies.flatMap((s) => s.items.map((i) => i.id)))
	);

	function projectIds(project: CatalogProject): string[] {
		return project.studies.flatMap((s) => s.items.map((i) => i.id));
	}

	function setAll(ids: string[], checked: boolean) {
		for (const id of ids) {
			if (checked) selected.add(id);
			else selected.delete(id);
		}
	}

	function checkState(ids: string[]) {
		const count = ids.filter((id) => selected.has(id)).length;
		return {
			checked: count > 0 && count === ids.length,
			indeterminate: count > 0 && count < ids.length
		};
	}
</script>

<form
	method="POST"
	action="?/save"
	class="flex min-h-0 flex-1 flex-col"
	use:enhance={() => {
		saving = true;
		error = '';
		return async ({ result, update }) => {
			saving = false;
			if (result.type === 'failure') {
				error = String(result.data?.message ?? 'Could not save the passcode.');
				return;
			}
			await update();
			onSaved();
		};
	}}
>
	{#if passcode}<input type="hidden" name="id" value={passcode.id} />{/if}
	<input type="hidden" name="expiresAt" value={expiresIso} />
	<input type="hidden" name="allowDownload" value={allowDownload ? 'on' : ''} />
	{#each selected as id (id)}<input type="hidden" name="itemId" value={id} />{/each}

	<div class="flex flex-col gap-4 px-4">
		<div class="flex flex-col gap-2">
			<Label for="passcode-label">Label</Label>
			<Input
				id="passcode-label"
				name="label"
				bind:value={label}
				placeholder="e.g. Dr. Müller, orthopedics"
				required
			/>
		</div>
		<div class="flex flex-col gap-2">
			<Label for="passcode-code">Code</Label>
			<Input
				id="passcode-code"
				name="code"
				bind:value={code}
				required
				minlength={6}
				autocomplete="off"
				autocapitalize="characters"
				spellcheck={false}
				class="font-mono tracking-widest uppercase"
				aria-describedby="passcode-code-hint"
			/>
			<p id="passcode-code-hint" class="text-xs text-muted-foreground">
				At least 6 letters or digits. Case, spaces and dashes are ignored.
			</p>
		</div>
		<div class="flex flex-col gap-2">
			<Label for="passcode-expiry">Expires</Label>
			<Input
				id="passcode-expiry"
				type="datetime-local"
				class="appearance-none [&::-webkit-date-and-time-value]:text-left"
				bind:value={expiresLocal}
				required
			/>
			<div class="flex gap-1">
				{#each [7, 30, 90] as days (days)}
					<Button
						variant="outline"
						size="xs"
						onclick={() => (expiresLocal = toLocalInput(new Date(Date.now() + days * DAY)))}
					>
						{days} days
					</Button>
				{/each}
			</div>
		</div>
		<div class="flex items-start gap-2">
			<Checkbox
				id="passcode-downloads"
				bind:checked={allowDownload}
				aria-describedby="passcode-downloads-hint"
			/>
			<div class="flex flex-col gap-1">
				<Label for="passcode-downloads">Allow downloads</Label>
				<p id="passcode-downloads-hint" class="text-xs text-muted-foreground">
					Shows download buttons for the shared items.
				</p>
			</div>
		</div>
	</div>

	<fieldset class="mt-6 flex min-h-0 min-w-0 flex-1 flex-col border-t">
		<legend class="sr-only">Shared items</legend>
		<div class="flex items-center justify-between px-4 py-3">
			<span class="text-sm font-medium">Shared items ({selected.size})</span>
			<label class="flex items-center gap-2 text-sm">
				<Checkbox
					{...checkState(allIds)}
					onCheckedChange={(checked) => setAll(allIds, checked)}
					disabled={allIds.length === 0}
				/>
				Select all
			</label>
		</div>
		<div class="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
			{#if catalog.length === 0}
				<p class="text-sm text-muted-foreground">Upload files to a project first.</p>
			{/if}
			{#each catalog as project (project.id)}
				{@const ids = projectIds(project)}
				<div class="mt-2 border-t pt-3">
					<label class="flex items-center gap-2 font-medium">
						<Checkbox {...checkState(ids)} onCheckedChange={(checked) => setAll(ids, checked)} />
						<span class="min-w-0 truncate">{project.name}</span>
					</label>
					{#each project.studies as study (study.key)}
						<p class="mt-3 ml-6 text-xs text-muted-foreground uppercase">
							{[formatDicomDate(study.date), study.description].filter(Boolean).join(' · ') ||
								'Study'}
						</p>
						<ul class="ml-6">
							{#each study.items as item (item.id)}
								<li>
									<label class="flex min-h-8 items-center gap-2 text-sm">
										<Checkbox
											checked={selected.has(item.id)}
											onCheckedChange={(checked) => setAll([item.id], checked)}
										/>
										<span class="min-w-0 flex-1 truncate">{item.label}</span>
										<span class="shrink-0 text-xs text-muted-foreground">
											{itemKindLabel(item)}
										</span>
									</label>
								</li>
							{/each}
						</ul>
					{/each}
				</div>
			{/each}
		</div>
	</fieldset>

	<div class="flex items-center gap-3 border-t p-4">
		{#if error}<p class="flex-1 text-sm text-destructive" role="alert">{error}</p>{/if}
		<Button type="submit" class="ml-auto" disabled={saving || !expiresIso}>
			{passcode ? 'Save changes' : 'Create passcode'}
		</Button>
	</div>
</form>
