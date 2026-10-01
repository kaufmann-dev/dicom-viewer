<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import { resolve } from '$app/paths';
	import BoxIcon from '@lucide/svelte/icons/box';
	import ImageIcon from '@lucide/svelte/icons/image';
	import ImageOffIcon from '@lucide/svelte/icons/image-off';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import type { CatalogItem } from '#lib/catalog.js';
	import { itemTypeText } from '#lib/item-kind.js';

	let { item, storeThumbnails = false }: { item: CatalogItem; storeThumbnails?: boolean } =
		$props();

	let rendered: string | null = $state(null);
	let storedFailed = $state(false);
	let failed = $state(false);

	const stored = $derived(
		item.thumbnail?.stored && !storedFailed
			? `/api/files/${item.thumbnail.instanceId}/thumbnail`
			: null
	);
	const src = $derived(stored ?? rendered);

	/**
	 * Renders a thumbnail the server does not store yet once the tile scrolls into view, and lets
	 * admins store it for later visitors. Cornerstone is browser-only.
	 */
	const lazyThumbnail: Attachment<HTMLElement> = (element) => {
		const thumbnail = item.thumbnail;
		const kind = item.kind;
		if (!thumbnail || kind === 'sr' || (thumbnail.stored && !storedFailed)) return;
		const store = storeThumbnails;
		let cancelled = false;
		const observer = new IntersectionObserver(
			async (entries) => {
				if (!entries.some((e) => e.isIntersecting)) return;
				observer.disconnect();
				try {
					const { loadThumbnail, storeThumbnail } = await import('#lib/viewer/thumbnails.js');
					const url = await loadThumbnail(thumbnail.instanceId, kind);
					if (!cancelled) rendered = url;
					// Failures are harmless: the next admin visit tries again.
					if (store) storeThumbnail(thumbnail.instanceId, url).catch(() => {});
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
			<img
				{src}
				alt=""
				loading="lazy"
				decoding="async"
				class="h-full w-full object-contain"
				onerror={() => (storedFailed = true)}
			/>
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
