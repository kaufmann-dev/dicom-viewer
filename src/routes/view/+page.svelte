<script lang="ts">
	import { resolve } from '$app/paths';
	import BoxIcon from '@lucide/svelte/icons/box';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import ImageIcon from '@lucide/svelte/icons/image';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import { itemTypeText } from '$lib/item-kind';
	import { formatDicomDate } from '$lib/sr';
	import type { CatalogItem } from '$lib/catalog';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	function iconFor(item: CatalogItem) {
		if (item.kind === 'stl') return BoxIcon;
		if (item.kind === 'sr') return FileTextIcon;
		return item.volume ? LayersIcon : ImageIcon;
	}
</script>

<svelte:head><title>Scans</title></svelte:head>

<main class="min-h-0 flex-1 overflow-y-auto">
	<div class="mx-auto w-full max-w-3xl px-4 py-8">
		{#if data.catalog.length === 0}
			<p class="py-16 text-center text-sm text-muted-foreground">
				{#if data.role === 'admin'}
					No scans yet. Create a project and upload files in <a
						class="underline"
						href={resolve('/admin')}>Admin</a
					>.
				{:else}
					No scans are shared with this passcode.
				{/if}
			</p>
		{/if}

		{#each data.catalog as project (project.id)}
			<section class="mb-12">
				<h2 class="text-xl font-semibold tracking-tight">{project.name}</h2>
				{#each project.studies as study (study.key)}
					<div class="mt-6">
						<h3 class="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
							{[formatDicomDate(study.date), study.description].filter(Boolean).join(' · ') ||
								'Study'}
						</h3>
						<ul class="mt-2 border-t">
							{#each study.items as item (item.id)}
								{@const Icon = iconFor(item)}
								<li class="border-b">
									<a
										href={resolve('/view/[itemId]', { itemId: item.id })}
										class="flex min-h-12 items-center gap-3 px-2 py-2 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
									>
										<Icon class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
										<span class="min-w-0 flex-1 truncate">{item.label}</span>
										<span class="shrink-0 text-xs text-muted-foreground">
											{[
												itemTypeText(item),
												item.instanceCount > 1 ? `${item.instanceCount} images` : null
											]
												.filter(Boolean)
												.join(' · ')}
										</span>
									</a>
								</li>
							{/each}
						</ul>
					</div>
				{/each}
			</section>
		{/each}
	</div>
</main>
