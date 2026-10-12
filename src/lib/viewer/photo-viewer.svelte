<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import { SvelteMap } from 'svelte/reactivity';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import ZoomInIcon from '@lucide/svelte/icons/zoom-in';
	import ZoomOutIcon from '@lucide/svelte/icons/zoom-out';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Spinner } from '#lib/components/ui/spinner/index.js';
	import MouseHint from './mouse-hint.svelte';

	let { instanceId }: { instanceId: string } = $props();

	const MAX_SCALE = 10;

	let container: HTMLDivElement;
	let phase: 'loading' | 'ready' | 'error' = $state('loading');
	let natural = { width: 1, height: 1 };
	/** Zoom relative to the fitted image, and pan in CSS pixels from the centered position. */
	let view = $state({ scale: 1, x: 0, y: 0 });

	/** Active pointers, for one-finger pan and two-finger pinch. */
	const pointers = new SvelteMap<number, { x: number; y: number }>();

	/** Keeps the image covering the view, or centered when it is smaller than the view. */
	function clamp(scale: number, x: number, y: number) {
		scale = Math.min(MAX_SCALE, Math.max(1, scale));
		const { clientWidth: width, clientHeight: height } = container;
		const fit = Math.min(width / natural.width, height / natural.height);
		const maxX = Math.max(0, (natural.width * fit * scale - width) / 2);
		const maxY = Math.max(0, (natural.height * fit * scale - height) / 2);
		view = {
			scale,
			x: Math.min(maxX, Math.max(-maxX, x)),
			y: Math.min(maxY, Math.max(-maxY, y))
		};
	}

	/** Zooms by `factor`, keeping the point at client coordinates (cx, cy) in place. */
	function zoomAt(factor: number, cx: number, cy: number) {
		const rect = container.getBoundingClientRect();
		const px = cx - rect.left - rect.width / 2;
		const py = cy - rect.top - rect.height / 2;
		const scale = Math.min(MAX_SCALE, Math.max(1, view.scale * factor));
		const ratio = scale / view.scale;
		clamp(scale, px - (px - view.x) * ratio, py - (py - view.y) * ratio);
	}

	function zoomCenter(factor: number) {
		const rect = container.getBoundingClientRect();
		zoomAt(factor, rect.left + rect.width / 2, rect.top + rect.height / 2);
	}

	function reset() {
		view = { scale: 1, x: 0, y: 0 };
	}

	function pinch() {
		const [a, b] = [...pointers.values()];
		return {
			distance: Math.hypot(a.x - b.x, a.y - b.y),
			x: (a.x + b.x) / 2,
			y: (a.y + b.y) / 2
		};
	}

	function onpointerdown(event: PointerEvent) {
		if (event.button !== 0 || phase !== 'ready') return;
		container.setPointerCapture(event.pointerId);
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
	}

	function onpointermove(event: PointerEvent) {
		const previous = pointers.get(event.pointerId);
		if (!previous) return;
		if (pointers.size === 1) {
			pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
			clamp(view.scale, view.x + event.clientX - previous.x, view.y + event.clientY - previous.y);
			return;
		}
		const before = pinch();
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		const after = pinch();
		if (before.distance > 0) zoomAt(after.distance / before.distance, after.x, after.y);
		clamp(view.scale, view.x + after.x - before.x, view.y + after.y - before.y);
	}

	function onpointerup(event: PointerEvent) {
		pointers.delete(event.pointerId);
	}

	/** Wheel zoom needs a non-passive listener to keep the page from scrolling. */
	const wheelZoom: Attachment<HTMLElement> = (element) => {
		const onwheel = (event: WheelEvent) => {
			event.preventDefault();
			if (phase === 'ready') zoomAt(Math.exp(-event.deltaY * 0.0015), event.clientX, event.clientY);
		};
		element.addEventListener('wheel', onwheel, { passive: false });
		return () => element.removeEventListener('wheel', onwheel);
	};

	/** Re-clamps the pan when the view changes size, e.g. on rotation. */
	const keepInView: Attachment<HTMLElement> = (element) => {
		const observer = new ResizeObserver(() => clamp(view.scale, view.x, view.y));
		observer.observe(element);
		return () => observer.disconnect();
	};
</script>

<div
	class="flex shrink-0 flex-wrap items-center gap-1 border-b bg-background px-2 py-1.5"
	role="toolbar"
	aria-label="Photo tools"
>
	<Button
		variant="ghost"
		size="icon-sm"
		aria-label="Zoom out"
		title="Zoom out"
		disabled={phase !== 'ready' || view.scale <= 1}
		onclick={() => zoomCenter(1 / 1.5)}
	>
		<ZoomOutIcon />
	</Button>
	<span class="w-12 text-center text-xs text-muted-foreground tabular-nums">
		{Math.round(view.scale * 100)}%
	</span>
	<Button
		variant="ghost"
		size="icon-sm"
		aria-label="Zoom in"
		title="Zoom in"
		disabled={phase !== 'ready' || view.scale >= MAX_SCALE}
		onclick={() => zoomCenter(1.5)}
	>
		<ZoomInIcon />
	</Button>
	<Button variant="ghost" size="sm" class="ml-auto" onclick={reset}>
		<RotateCcwIcon />Reset view
	</Button>
</div>
<MouseHint text="Wheel: zoom · Left-drag: pan · Double-click: fit" />

<div
	class="relative min-h-0 flex-1 touch-none overflow-hidden bg-black select-none"
	bind:this={container}
	{@attach wheelZoom}
	{@attach keepInView}
	{onpointerdown}
	{onpointermove}
	{onpointerup}
	onpointercancel={onpointerup}
	ondblclick={reset}
	role="application"
	aria-label="Photo viewer"
>
	<img
		src="/api/files/{instanceId}"
		alt=""
		draggable="false"
		class={[
			'absolute inset-0 h-full w-full object-contain',
			view.scale > 1 ? 'cursor-grab active:cursor-grabbing' : '',
			phase !== 'ready' && 'invisible'
		]}
		style:transform="translate({view.x}px, {view.y}px) scale({view.scale})"
		onload={(event) => {
			const image = event.currentTarget as HTMLImageElement;
			natural = { width: image.naturalWidth || 1, height: image.naturalHeight || 1 };
			phase = 'ready';
		}}
		onerror={() => (phase = 'error')}
	/>
	{#if phase !== 'ready'}
		<div class="absolute inset-0 flex items-center justify-center px-4 text-sm text-neutral-200">
			{#if phase === 'error'}
				<p role="alert">This photo could not be loaded. Reload the page to try again.</p>
			{:else}
				<div class="flex items-center gap-2" role="status"><Spinner />Loading photo…</div>
			{/if}
		</div>
	{/if}
</div>
