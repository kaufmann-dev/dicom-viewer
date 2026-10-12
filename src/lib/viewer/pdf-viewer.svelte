<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import ZoomInIcon from '@lucide/svelte/icons/zoom-in';
	import ZoomOutIcon from '@lucide/svelte/icons/zoom-out';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Progress } from '#lib/components/ui/progress/index.js';
	import { openPdf, renderPage, type PDFDocumentLoadingTask, type PDFPageProxy } from './pdf';

	let { instanceId }: { instanceId: string } = $props();

	/** CSS pixels per PDF point at 100 %, the physical size. */
	const CSS_PER_POINT = 96 / 72;
	const MAX_PAGE_WIDTH = 1000;
	const MIN_ZOOM = 0.5;
	const MAX_ZOOM = 4;
	const GAP = 16;

	let container: HTMLDivElement;
	let phase: 'loading' | 'ready' | 'error' = $state('loading');
	let progress = $state(0);
	let pages: PDFPageProxy[] = $state.raw([]);
	let availableWidth = $state(0);
	/** Zoom relative to fitting the widest page into the view. */
	let zoom = $state(1);
	let current = $state(1);
	const pageElements: HTMLElement[] = $state([]);

	const widest = $derived(Math.max(1, ...pages.map((p) => p.getViewport({ scale: 1 }).width)));
	const fitScale = $derived(Math.min(availableWidth, MAX_PAGE_WIDTH) / widest);
	const scale = $derived(fitScale * zoom);

	onMount(() => {
		let task: PDFDocumentLoadingTask | null = null;
		let destroyed = false;
		const resize = new ResizeObserver(() => {
			availableWidth = Math.max(0, container.clientWidth - 2 * GAP);
		});
		resize.observe(container);

		(async () => {
			task = await openPdf(instanceId, (loaded, total) => {
				if (total) progress = (loaded / total) * 100;
			});
			if (destroyed) return task.destroy();
			const pdf = await task.promise;
			const loaded = await Promise.all(
				Array.from({ length: pdf.numPages }, (_, i) => pdf.getPage(i + 1))
			);
			if (destroyed) return;
			pages = loaded;
			phase = 'ready';
		})().catch((error) => {
			if (destroyed) return;
			console.error(error);
			phase = 'error';
		});

		return () => {
			destroyed = true;
			resize.disconnect();
			void task?.destroy();
		};
	});

	/** Renders a page once it comes near the view, at the current scale. */
	function pageCanvas(page: PDFPageProxy, pageScale: number): Attachment<HTMLCanvasElement> {
		return (canvas) => {
			if (pageScale <= 0) return;
			let task: ReturnType<typeof renderPage> | null = null;
			const observer = new IntersectionObserver(
				(entries) => {
					if (!entries.some((e) => e.isIntersecting)) return;
					observer.disconnect();
					task = renderPage(page, canvas, pageScale);
					task.promise.catch((error: unknown) => {
						if ((error as { name?: string })?.name !== 'RenderingCancelledException') {
							console.error(error);
						}
					});
				},
				{ root: container, rootMargin: '800px 0px' }
			);
			observer.observe(canvas);
			return () => {
				observer.disconnect();
				task?.cancel();
			};
		};
	}

	/** Zooms while keeping the same part of the document in view. */
	async function setZoom(value: number) {
		const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
		if (next === zoom) return;
		const ratio = next / zoom;
		const top = container.scrollTop;
		const left = container.scrollLeft;
		zoom = next;
		await tick();
		container.scrollTop = top * ratio;
		container.scrollLeft = left * ratio;
	}

	/** The page that covers the upper third of the view. */
	function onscroll() {
		const mark = container.scrollTop + container.clientHeight / 3;
		let page = 1;
		for (const [index, element] of pageElements.entries()) {
			if (element && element.offsetTop <= mark) page = index + 1;
		}
		current = page;
	}
</script>

<div
	class="flex shrink-0 flex-wrap items-center gap-1 border-b bg-background px-2 py-1.5"
	role="toolbar"
	aria-label="Document tools"
>
	<Button
		variant="ghost"
		size="icon-sm"
		aria-label="Zoom out"
		title="Zoom out"
		disabled={phase !== 'ready' || zoom <= MIN_ZOOM}
		onclick={() => setZoom(zoom / 1.25)}
	>
		<ZoomOutIcon />
	</Button>
	<span class="w-12 text-center text-xs text-muted-foreground tabular-nums">
		{phase === 'ready' ? `${Math.round((scale / CSS_PER_POINT) * 100)}%` : ''}
	</span>
	<Button
		variant="ghost"
		size="icon-sm"
		aria-label="Zoom in"
		title="Zoom in"
		disabled={phase !== 'ready' || zoom >= MAX_ZOOM}
		onclick={() => setZoom(zoom * 1.25)}
	>
		<ZoomInIcon />
	</Button>
	<Button
		variant="ghost"
		size="sm"
		disabled={phase !== 'ready' || zoom === 1}
		onclick={() => setZoom(1)}
	>
		Fit width
	</Button>
	{#if phase === 'ready'}
		<span class="ml-auto px-2 text-xs text-muted-foreground tabular-nums" aria-live="polite">
			Page {current} / {pages.length}
		</span>
	{/if}
</div>

<div class="relative min-h-0 flex-1 overflow-auto bg-muted" bind:this={container} {onscroll}>
	{#if phase === 'ready'}
		<div
			class="flex w-max min-w-full flex-col items-center"
			style:gap="{GAP}px"
			style:padding="{GAP}px"
		>
			{#each pages as page, index (index)}
				{@const viewport = page.getViewport({ scale })}
				<div
					bind:this={pageElements[index]}
					class="shrink-0 bg-white shadow-sm"
					style:width="{Math.floor(viewport.width)}px"
					style:height="{Math.floor(viewport.height)}px"
				>
					<canvas
						class="block h-full w-full"
						aria-label="Page {index + 1}"
						{@attach pageCanvas(page, scale)}
					></canvas>
				</div>
			{/each}
		</div>
	{:else}
		<div class="absolute inset-0 flex items-center justify-center px-4 text-sm">
			{#if phase === 'error'}
				<p role="alert">This document could not be loaded. Reload the page to try again.</p>
			{:else}
				<div class="w-full max-w-xs text-center" role="status">
					<p>Loading document…</p>
					<Progress class="mt-3" value={progress} max={100} />
				</div>
			{/if}
		</div>
	{/if}
</div>
