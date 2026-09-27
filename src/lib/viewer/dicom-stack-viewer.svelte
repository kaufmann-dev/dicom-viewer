<script lang="ts">
	import { onMount } from 'svelte';
	import { cache, Enums, RenderingEngine, type Types } from '@cornerstonejs/core';
	import { ToolGroupManager, type Types as ToolTypes } from '@cornerstonejs/tools';
	import { Slider } from '$lib/components/ui/slider';
	import {
		addViewingTools,
		applyToolBindings,
		CT_WINDOW_PRESETS,
		imageIdFor,
		initCornerstone,
		clearInstanceMetadata,
		destroyRenderingEngine,
		defaultVoiRange,
		voiRange,
		type PrimaryTool,
		type WindowPreset
	} from './cornerstone';
	import ViewerToolbar from './viewer-toolbar.svelte';

	let { instanceIds, modality }: { instanceIds: string[]; modality: string | null } = $props();

	const TOOLS: PrimaryTool[] = ['windowLevel', 'pan', 'zoom', 'length'];
	const uid = crypto.randomUUID();
	const engineId = `engine-${uid}`;
	const viewportId = `stack-${uid}`;
	const groupId = `stack-group-${uid}`;

	let element: HTMLDivElement;
	let phase: 'loading' | 'ready' | 'error' = $state('loading');
	let primary: PrimaryTool = $state('windowLevel');
	let index = $state(0);

	let engine: RenderingEngine | undefined;
	let group: ToolTypes.IToolGroup | undefined;

	function viewport(): Types.IStackViewport | undefined {
		return engine?.getViewport(viewportId) as Types.IStackViewport | undefined;
	}

	onMount(() => {
		let destroyed = false;
		const resizeObserver = new ResizeObserver(() => engine?.resize(true, false));
		const onNewImage = () => (index = viewport()?.getCurrentImageIdIndex() ?? 0);

		async function start() {
			initCornerstone();
			engine = new RenderingEngine(engineId);
			engine.enableElement({
				viewportId,
				type: Enums.ViewportType.STACK,
				element,
				defaultOptions: { background: [0, 0, 0] as Types.Point3 }
			});
			group = ToolGroupManager.createToolGroup(groupId)!;
			addViewingTools(group, TOOLS);
			group.addViewport(viewportId, engineId);
			applyToolBindings(group, TOOLS, primary);

			element.addEventListener(Enums.Events.STACK_NEW_IMAGE, onNewImage);
			await viewport()!.setStack(instanceIds.map(imageIdFor), Math.floor(instanceIds.length / 2));
			if (destroyed) return;
			resizeObserver.observe(element);
			applyDefaultWindow();
			phase = 'ready';
		}

		start().catch((error) => {
			console.error(error);
			if (!destroyed) phase = 'error';
		});

		return () => {
			destroyed = true;
			resizeObserver.disconnect();
			element.removeEventListener(Enums.Events.STACK_NEW_IMAGE, onNewImage);
			ToolGroupManager.destroyToolGroup(groupId);
			if (engine) destroyRenderingEngine(engine);
			cache.purgeCache();
			clearInstanceMetadata();
		};
	});

	function selectTool(tool: PrimaryTool) {
		primary = tool;
		if (group) applyToolBindings(group, TOOLS, tool);
	}

	function applyWindow(preset: WindowPreset) {
		viewport()?.setProperties({ voiRange: voiRange(preset) });
		viewport()?.render();
	}

	/** Applies the image's stored window, or its full pixel range when it has none. */
	function applyDefaultWindow() {
		const vp = viewport();
		const image = vp?.getCornerstoneImage();
		if (!vp || !image) return;
		vp.setProperties({ voiRange: defaultVoiRange(image) });
		vp.render();
	}

	function reset() {
		viewport()?.resetCamera();
		viewport()?.resetProperties();
		applyDefaultWindow();
	}

	function goTo(value: number) {
		index = value;
		void viewport()?.setImageIdIndex(value);
	}
</script>

<ViewerToolbar
	tools={TOOLS}
	{primary}
	onPrimary={selectTool}
	presets={modality === 'CT' ? CT_WINDOW_PRESETS : []}
	onPreset={applyWindow}
	onReset={reset}
/>

<div class="relative min-h-0 flex-1 bg-black">
	<div
		class="h-full w-full"
		bind:this={element}
		oncontextmenu={(e) => e.preventDefault()}
		role="img"
		aria-label="Image viewer"
	></div>

	{#if phase !== 'ready'}
		<div class="absolute inset-0 flex items-center justify-center px-4 text-sm text-neutral-200">
			{#if phase === 'error'}
				<p role="alert">This image could not be loaded. Reload the page to try again.</p>
			{:else}
				<p role="status">Loading image…</p>
			{/if}
		</div>
	{/if}
</div>

{#if instanceIds.length > 1}
	<div class="flex shrink-0 items-center gap-4 border-t px-4 py-3">
		<Slider
			type="single"
			min={0}
			max={instanceIds.length - 1}
			step={1}
			value={index}
			onValueChange={goTo}
			aria-label="Image"
			class="flex-1"
		/>
		<span class="w-20 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
			{index + 1} / {instanceIds.length}
		</span>
	</div>
{/if}
