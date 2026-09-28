<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import { resolve } from '$app/paths';
	import BoxIcon from '@lucide/svelte/icons/box';
	import ImageIcon from '@lucide/svelte/icons/image';
	import ImageOffIcon from '@lucide/svelte/icons/image-off';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import type { CatalogItem } from '$lib/catalog';
	import { itemTypeText } from '$lib/item-kind';

	let { item }: { item: CatalogItem } = $props();

	let src: string | null = $state(null);
	let failed = $state(false);

	/** Loads the thumbnail once the tile scrolls into view. Cornerstone is browser-only. */
	const lazyThumbnail: Attachment<HTMLElement> = (element) => {
		const instanceId = item.thumbnailInstanceId;
		const kind = item.kind;
		if (!instanceId || kind === 'sr') return;
		let cancelled = false;
		const observer = new IntersectionObserver(
			async (entries) => {
				if (!entries.some((e) => e.isIntersecting)) return;
				observer.disconnect();
				try {
					const { loadThumbnail } = await import('$lib/viewer/thumbnails');
					const url = await loadThumbnail(instanceId, kind);
					if (!cancelled) src = url;
				} catch {
					if (!cancelled) failed = true;
				}
			},
			{ rootMargin: '200px' }
		);
		observer.observe(element);
		return () => {
			cancelled = true;
			observer.disconnect();
		};
	};

	const Icon = $derived(
		failed ? ImageOffIcon : item.kind === 'stl' ? BoxIcon : item.volume ? LayersIcon : ImageIcon
	);
	const detail = $derived(
		[itemTypeText(item), item.instanceCount > 1 ? `${item.instanceCount} images` : null]
			.filter(Boolean)
			.join(' · ')
	);
</script>

<a
	href={resolve('/view/[itemId]', { itemId: item.id })}
	class="group flex min-w-0 flex-col rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
>
	<div
		class="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-black text-neutral-500"
		{@attach lazyThumbnail}
	>
		{#if src}
			<img {src} alt="" class="h-full w-full object-contain" />
		{:else}
			<Icon class="size-10" aria-hidden="true" />
		{/if}
		{#if item.volume}
			<span
				class="absolute top-2 left-2 rounded-md bg-white/85 px-1.5 py-0.5 text-xs font-semibold text-neutral-800"
			>
				3D
			</span>
		{/if}
	</div>
	<span class="mt-2 truncate text-sm font-medium group-hover:underline">{item.label}</span>
	<span class="truncate text-xs text-muted-foreground">{detail}</span>
</a>
