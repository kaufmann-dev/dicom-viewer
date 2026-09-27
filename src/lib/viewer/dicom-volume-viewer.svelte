<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import {
		cache,
		CONSTANTS,
		Enums,
		RenderingEngine,
		setVolumesForViewports,
		volumeLoader,
		type Types
	} from '@cornerstonejs/core';
	import { ToolGroupManager, type Types as ToolTypes } from '@cornerstonejs/tools';
	import { Progress } from '$lib/components/ui/progress';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import { NativeSelect, NativeSelectOption } from '$lib/components/ui/native-select';
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
	import ViewerToolbar from './viewer-toolbar.svelte';

	let { instanceIds, modality }: { instanceIds: string[]; modality: string | null } = $props();

	type Pane = 'axial' | 'sagittal' | 'coronal' | '3d';
	const PANES: { id: Pane; label: string }[] = [
		{ id: 'axial', label: 'Axial' },
		{ id: 'sagittal', label: 'Sagittal' },
		{ id: 'coronal', label: 'Coronal' },
		{ id: '3d', label: '3D' }
	];
	const TOOLS: PrimaryTool[] = ['crosshairs', 'windowLevel', 'pan', 'zoom', 'length'];
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
	let layout: 'grid' | Pane = $state('grid');
	// The page re-creates this component per item, so the initial modality is sufficient.
	let vrReady = $state(false);
	let vrPreset = $state(untrack(() => (modality === 'MR' ? 'MR-Default' : 'CT-Bone')));

	let engine: RenderingEngine | undefined;
	let mprGroup: ToolTypes.IToolGroup | undefined;

	onMount(() => {
		let destroyed = false;
		let stopAdaptiveQuality = () => {};
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
			applyToolBindings(mprGroup, TOOLS, primary);

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
			applyVrPreset();
			stopAdaptiveQuality = adaptiveVolumeQuality(
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
			stopAdaptiveQuality();
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

	function selectTool(tool: PrimaryTool) {
		primary = tool;
		if (mprGroup) applyToolBindings(mprGroup, TOOLS, tool);
	}

	function applyWindow(preset: WindowPreset) {
		if (!engine) return;
		for (const viewport of orthoViewports()) viewport.setProperties({ voiRange: voiRange(preset) });
		engine.renderViewports(orthoIds);
	}

	function applyVrPreset() {
		const viewport = engine?.getViewport(viewportIds['3d']) as Types.IVolumeViewport | undefined;
		viewport?.setProperties({ preset: vrPreset });
		viewport?.render();
	}

	function reset() {
		if (!engine) return;
		for (const viewport of orthoViewports()) {
			viewport.resetCamera();
			viewport.resetProperties();
		}
		if (vrReady) {
			(engine.getViewport(viewportIds['3d']) as Types.IVolumeViewport).resetCamera();
			applyVrPreset();
		}
		engine.render();
	}

	async function changeLayout(value: string) {
		layout = (value || 'grid') as typeof layout;
		await tick();
		engine?.resize(true, false);
	}
</script>

<ViewerToolbar
	tools={TOOLS}
	{primary}
	onPrimary={selectTool}
	presets={modality === 'CT' ? CT_WINDOW_PRESETS : []}
	onPreset={applyWindow}
	onReset={reset}
>
	<span class="mx-1 h-5 w-px bg-border max-sm:hidden" aria-hidden="true"></span>
	<div class="flex items-center gap-2">
		<span class="text-xs text-muted-foreground" id="{uid}-layout-label">Layout</span>
		<ToggleGroup.Root
			type="single"
			size="sm"
			variant="outline"
			value={layout}
			onValueChange={changeLayout}
			aria-labelledby="{uid}-layout-label"
		>
			<ToggleGroup.Item value="grid">All</ToggleGroup.Item>
			{#each PANES as pane (pane.id)}
				<ToggleGroup.Item value={pane.id}>{pane.label}</ToggleGroup.Item>
			{/each}
		</ToggleGroup.Root>
	</div>
	<span class="mx-1 h-5 w-px bg-border max-sm:hidden" aria-hidden="true"></span>
	<label class="flex items-center gap-2 text-xs text-muted-foreground">
		3D preset
		<NativeSelect size="sm" bind:value={vrPreset} onchange={applyVrPreset} disabled={!vrReady}>
			{#each VR_PRESETS as name (name)}
				<NativeSelectOption value={name}>{name}</NativeSelectOption>
			{/each}
		</NativeSelect>
	</label>
</ViewerToolbar>

<div class="relative min-h-0 flex-1 bg-black" bind:this={container}>
	<div
		class={[
			'grid h-full w-full gap-px bg-neutral-800',
			layout === 'grid' ? 'grid-cols-1 grid-rows-4 sm:grid-cols-2 sm:grid-rows-2' : 'grid-cols-1'
		]}
	>
		{#each PANES as pane (pane.id)}
			<div
				class={[
					'relative min-h-0 min-w-0 bg-black',
					layout !== 'grid' && layout !== pane.id && 'hidden'
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
