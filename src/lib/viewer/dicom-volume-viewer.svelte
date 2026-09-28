<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import {
		cache,
		CONSTANTS,
		Enums,
		RenderingEngine,
		setVolumesForViewports,
		utilities,
		volumeLoader,
		type Types
	} from '@cornerstonejs/core';
	import { CrosshairsTool, ToolGroupManager, type Types as ToolTypes } from '@cornerstonejs/tools';
	import { Progress } from '$lib/components/ui/progress';
	import * as Segmented from '$lib/components/segmented';
	import BoxIcon from '@lucide/svelte/icons/box';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import LayoutGridIcon from '@lucide/svelte/icons/layout-grid';
	import { FIELD_SURFACE } from '$lib/components/field-surface';
	import { IsMobile } from '$lib/hooks/is-mobile.svelte';
	import { buttonVariants } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Slider } from '$lib/components/ui/slider';
	import {
		add3dTools,
		addViewingTools,
		applyToolBindings,
		CT_WINDOW_PRESETS,
		imageIdFor,
		initCornerstone,
		prefetchInstances,
		clearInstanceMetadata,
		voiRange,
		type PrimaryTool,
		type WindowPreset
	} from './cornerstone';
	import { adaptiveVolumeQuality } from './adaptive-volume-quality';
	import { MOUSE_HINTS_3D } from './mouse-hints';
	import { presetThreshold, shiftPreset, THRESHOLD_SHIFT } from './volume-threshold';
	import ViewerToolbar from './viewer-toolbar.svelte';

	let { instanceIds, modality }: { instanceIds: string[]; modality: string | null } = $props();

	type Pane = 'axial' | 'sagittal' | 'coronal' | '3d';
	type Layout = 'grid' | Pane;
	const PANES: { id: Pane; label: string }[] = [
		{ id: 'axial', label: 'Axial' },
		{ id: 'sagittal', label: 'Sagittal' },
		{ id: 'coronal', label: 'Coronal' },
		{ id: '3d', label: '3D' }
	];
	const TOOLS: PrimaryTool[] = ['crosshairs', 'scroll', 'windowLevel', 'pan', 'zoom', 'length'];
	const VR_PRESETS = $derived(
		CONSTANTS.VIEWPORT_PRESETS.map((p) => p.name).filter((name) =>
			modality === 'MR' ? name.startsWith('MR') : name.startsWith('CT')
		)
	);

	const uid = crypto.randomUUID();
	const engineId = `engine-${uid}`;
	const volumeId = `cornerstoneStreamingImageVolume:${uid}`;
	const mprGroupId = `mpr-${uid}`;
	const vrGroupId = `vr-${uid}`;
	const viewportIds: Record<Pane, string> = {
		axial: `axial-${uid}`,
		sagittal: `sagittal-${uid}`,
		coronal: `coronal-${uid}`,
		'3d': `3d-${uid}`
	};
	const orthoIds = [viewportIds.axial, viewportIds.sagittal, viewportIds.coronal];

	let elements: Partial<Record<Pane, HTMLDivElement>> = $state({});
	let container: HTMLDivElement;
	let phase: 'downloading' | 'ready' | 'error' = $state('downloading');
	let loaded = $state(0);
	let primary: PrimaryTool = $state('crosshairs');
	let layout: Layout = $state('grid');
	// Phones are too small for four panes, so they offer single panes only.
	const isMobile = new IsMobile();
	const shownLayout: Layout = $derived(isMobile.current && layout === 'grid' ? 'axial' : layout);
	// Crosshairs only help when the other planes are visible, so single panes drop them.
	// Switching between single panes keeps the same tools, so the bindings are not reapplied.
	const singlePane = $derived(shownLayout !== 'grid');
	const tools = $derived(singlePane ? TOOLS.filter((t) => t !== 'crosshairs') : TOOLS);
	const activePrimary = $derived(tools.includes(primary) ? primary : 'scroll');
	// The page re-creates this component per item, so the initial modality is sufficient.
	let vrReady = $state(false);
	let vrPreset = $state(untrack(() => (modality === 'MR' ? 'MR-Default' : 'CT-Bone')));
	const basePreset = $derived(CONSTANTS.VIEWPORT_PRESETS.find((p) => p.name === vrPreset)!);
	// HU thresholds only make sense for CT; MR intensities have no fixed scale.
	const baseThreshold = $derived(modality === 'CT' ? presetThreshold(basePreset) : null);
	let vrThreshold = $state(0);

	let engine: RenderingEngine | undefined;
	let mprGroup: ToolTypes.IToolGroup | undefined;
	let adaptiveQuality: ReturnType<typeof adaptiveVolumeQuality> | undefined;

	onMount(() => {
		let destroyed = false;
		const resizeObserver = new ResizeObserver(() => engine?.resize(true, false));

		async function start() {
			initCornerstone();
			const imageIds = instanceIds.map(imageIdFor);
			await prefetchInstances(imageIds, (n) => (loaded = n));
			if (destroyed) return;

			engine = new RenderingEngine(engineId);
			const { ViewportType, OrientationAxis } = Enums;
			engine.setViewports([
				...(['axial', 'sagittal', 'coronal'] as const).map((pane) => ({
					viewportId: viewportIds[pane],
					type: ViewportType.ORTHOGRAPHIC,
					element: elements[pane]!,
					defaultOptions: {
						orientation: {
							axial: OrientationAxis.AXIAL,
							sagittal: OrientationAxis.SAGITTAL,
							coronal: OrientationAxis.CORONAL
						}[pane],
						background: [0, 0, 0] as Types.Point3
					}
				})),
				{
					viewportId: viewportIds['3d'],
					type: ViewportType.VOLUME_3D,
					element: elements['3d']!,
					defaultOptions: {
						orientation: OrientationAxis.CORONAL,
						background: [0, 0, 0] as Types.Point3
					}
				}
			]);

			const volume = await volumeLoader.createAndCacheVolume(volumeId, { imageIds });
			if (destroyed) return;
			// The 3D view joins once every slice is decoded; re-rendering it for each
			// progressively loaded slice would dominate the loading time.
			volume.load(() => {
				if (!destroyed) void attach3d().catch(reportError);
			});
			await setVolumesForViewports(engine, [{ volumeId }], orthoIds);
			if (destroyed) return;

			mprGroup = ToolGroupManager.createToolGroup(mprGroupId)!;
			addViewingTools(mprGroup, TOOLS);
			for (const id of orthoIds) mprGroup.addViewport(id, engineId);
			applyMprTools(mprGroup, tools, activePrimary);

			const vrGroup = ToolGroupManager.createToolGroup(vrGroupId)!;
			add3dTools(vrGroup);
			vrGroup.addViewport(viewportIds['3d'], engineId);

			resizeObserver.observe(container);
			engine.render();
			if (phase !== 'error') phase = 'ready';
		}

		async function attach3d() {
			await setVolumesForViewports(engine!, [{ volumeId }], [viewportIds['3d']]);
			if (destroyed) return;
			vrReady = true;
			resetVrThreshold();
			applyVrPreset();
			adaptiveQuality = adaptiveVolumeQuality(
				elements['3d']!,
				() => engine?.getViewport(viewportIds['3d']) as Types.IVolumeViewport | undefined
			);
		}

		function reportError(error: unknown) {
			console.error(error);
			if (!destroyed) phase = 'error';
		}

		start().catch(reportError);

		return () => {
			destroyed = true;
			adaptiveQuality?.destroy();
			resizeObserver.disconnect();
			ToolGroupManager.destroyToolGroup(mprGroupId);
			ToolGroupManager.destroyToolGroup(vrGroupId);
			engine?.destroy();
			cache.purgeCache();
			clearInstanceMetadata();
		};
	});

	function orthoViewports(): Types.IVolumeViewport[] {
		return orthoIds.map((id) => engine!.getViewport(id) as Types.IVolumeViewport);
	}

	/** Binds the tools; disabling the crosshairs also removes their lines. */
	function applyMprTools(group: ToolTypes.IToolGroup, available: PrimaryTool[], tool: PrimaryTool) {
		applyToolBindings(group, available, tool);
		if (!available.includes('crosshairs')) group.setToolDisabled(CrosshairsTool.toolName);
	}

	$effect(() => {
		// Read both before the group check, so the effect tracks them before the group exists.
		const available = tools;
		const tool = activePrimary;
		if (mprGroup) applyMprTools(mprGroup, available, tool);
	});

	function applyWindow(preset: WindowPreset) {
		if (!engine) return;
		for (const viewport of orthoViewports()) viewport.setProperties({ voiRange: voiRange(preset) });
		engine.renderViewports(orthoIds);
	}

	function applyVrPreset() {
		const viewport = engine?.getViewport(viewportIds['3d']) as Types.IVolumeViewport | undefined;
		if (!viewport) return;
		utilities.applyPreset(
			viewport.getDefaultActor().actor as Types.VolumeActor,
			baseThreshold === null ? basePreset : shiftPreset(basePreset, vrThreshold - baseThreshold)
		);
		viewport.render();
	}

	function resetVrThreshold() {
		vrThreshold = baseThreshold ?? 0;
	}

	function reset() {
		if (!engine) return;
		for (const viewport of orthoViewports()) {
			viewport.resetCamera();
			viewport.resetProperties();
		}
		if (vrReady) {
			(engine.getViewport(viewportIds['3d']) as Types.IVolumeViewport).resetCamera();
			resetVrThreshold();
			applyVrPreset();
		}
		engine.render();
	}

	// Hiding or showing panes does not resize the container, so the observer does not notice it.
	// Cornerstone skips resizing while a render is scheduled (tool changes schedule one), which
	// would leave a pane that was attached while hidden blank, so resize on the next frame.
	$effect(() => {
		void shownLayout;
		const frame = requestAnimationFrame(() => engine?.resize(true, false));
		return () => cancelAnimationFrame(frame);
	});
</script>

<ViewerToolbar
	{tools}
	primary={activePrimary}
	onPrimary={(tool) => (primary = tool)}
	presets={modality === 'CT' ? CT_WINDOW_PRESETS : []}
	onPreset={applyWindow}
	onReset={reset}
>
	<Segmented.Root
		size="sm"
		value={shownLayout}
		onValueChange={(value) => (layout = value as Layout)}
		aria-label="Layout"
	>
		{#if !isMobile.current}
			<Segmented.Item value="grid"><LayoutGridIcon />All</Segmented.Item>
		{/if}
		{#each PANES as pane (pane.id)}
			<Segmented.Item value={pane.id}>{pane.label}</Segmented.Item>
		{/each}
	</Segmented.Root>
	<DropdownMenu.Root>
		<DropdownMenu.Trigger
			class={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), FIELD_SURFACE)}
			disabled={!vrReady}
			aria-label="3D preset: {vrPreset}"
		>
			<BoxIcon />3D: {vrPreset}<ChevronDownIcon class="text-muted-foreground" />
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end" class="min-w-64">
			<DropdownMenu.Label>3D presets</DropdownMenu.Label>
			<DropdownMenu.RadioGroup
				value={vrPreset}
				onValueChange={(value) => {
					vrPreset = value;
					resetVrThreshold();
					applyVrPreset();
				}}
			>
				{#each VR_PRESETS as name (name)}
					<DropdownMenu.RadioItem value={name}>{name}</DropdownMenu.RadioItem>
				{/each}
			</DropdownMenu.RadioGroup>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
	{#if baseThreshold !== null}
		<div class="flex items-center gap-2 text-sm">
			<span class="text-muted-foreground">Threshold</span>
			<Slider
				type="single"
				class="w-32"
				min={baseThreshold - THRESHOLD_SHIFT.below}
				max={baseThreshold + THRESHOLD_SHIFT.above}
				step={THRESHOLD_SHIFT.step}
				value={vrThreshold}
				onValueChange={(value) => {
					vrThreshold = value;
					adaptiveQuality?.interact();
					applyVrPreset();
				}}
				disabled={!vrReady}
				aria-label="3D threshold in HU"
			/>
			<span class="min-w-16 text-right tabular-nums">{Math.round(vrThreshold)} HU</span>
		</div>
	{/if}
</ViewerToolbar>

<div class="relative min-h-0 flex-1 bg-black" bind:this={container}>
	<div
		class={[
			'grid h-full w-full gap-px bg-neutral-800',
			shownLayout === 'grid' ? 'grid-cols-2 grid-rows-2' : 'grid-cols-1'
		]}
	>
		{#each PANES as pane (pane.id)}
			<div
				class={[
					'relative min-h-0 min-w-0 bg-black',
					shownLayout !== 'grid' && shownLayout !== pane.id && 'hidden'
				]}
			>
				<div
					class="h-full w-full"
					bind:this={elements[pane.id]}
					oncontextmenu={(e) => e.preventDefault()}
					role="img"
					aria-label="{pane.label} view"
				></div>
				<span
					class="pointer-events-none absolute top-1 left-2 text-xs font-medium text-neutral-300"
				>
					{pane.label}
				</span>
				{#if pane.id === '3d' && vrReady}
					<span
						class="pointer-events-none absolute bottom-1 left-2 text-xs text-neutral-400 pointer-coarse:hidden"
					>
						{MOUSE_HINTS_3D}
					</span>
				{/if}
				{#if pane.id === '3d' && phase === 'ready' && !vrReady}
					<p
						class="absolute inset-0 flex items-center justify-center text-sm text-neutral-300"
						role="status"
					>
						3D view appears when all slices are loaded…
					</p>
				{/if}
			</div>
		{/each}
	</div>

	{#if phase !== 'ready'}
		<div
			class="absolute inset-0 flex items-center justify-center bg-black/90 px-4 text-neutral-200"
		>
			{#if phase === 'error'}
				<p role="alert">This series could not be loaded. Reload the page to try again.</p>
			{:else}
				<div class="w-full max-w-xs text-center text-sm" role="status">
					<p>Loading images {loaded} / {instanceIds.length}</p>
					<Progress class="mt-3" value={loaded} max={instanceIds.length} />
				</div>
			{/if}
		</div>
	{/if}
</div>
