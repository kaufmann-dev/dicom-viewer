<script lang="ts">
	import type { Snippet } from 'svelte';
	import CrosshairIcon from '@lucide/svelte/icons/crosshair';
	import HandIcon from '@lucide/svelte/icons/hand';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import RulerIcon from '@lucide/svelte/icons/ruler';
	import SunMediumIcon from '@lucide/svelte/icons/sun-medium';
	import ZoomInIcon from '@lucide/svelte/icons/zoom-in';
	import { Button } from '$lib/components/ui/button';
	import { PRIMARY_TOOL_LABELS, type PrimaryTool, type WindowPreset } from './cornerstone';

	let {
		tools,
		primary,
		onPrimary,
		presets = [],
		onPreset,
		onReset,
		children
	}: {
		tools: PrimaryTool[];
		primary: PrimaryTool;
		onPrimary: (tool: PrimaryTool) => void;
		presets?: WindowPreset[];
		onPreset?: (preset: WindowPreset) => void;
		onReset: () => void;
		children?: Snippet;
	} = $props();

	const icons = {
		crosshairs: CrosshairIcon,
		windowLevel: SunMediumIcon,
		pan: HandIcon,
		zoom: ZoomInIcon,
		length: RulerIcon
	};
</script>

<div
	class="flex shrink-0 flex-wrap items-center gap-1 border-b bg-background px-2 py-1"
	role="toolbar"
	aria-label="Viewer tools"
>
	<div class="flex items-center gap-1" role="group" aria-label="Left mouse button tool">
		{#each tools as tool (tool)}
			{@const Icon = icons[tool]}
			<Button
				variant={primary === tool ? 'default' : 'ghost'}
				size="sm"
				aria-pressed={primary === tool}
				onclick={() => onPrimary(tool)}
			>
				<Icon />
				<span class="hidden md:inline">{PRIMARY_TOOL_LABELS[tool]}</span>
				<span class="sr-only md:hidden">{PRIMARY_TOOL_LABELS[tool]}</span>
			</Button>
		{/each}
	</div>

	{#if presets.length && onPreset}
		<span class="mx-1 h-5 w-px bg-border" aria-hidden="true"></span>
		<div class="flex items-center gap-1" role="group" aria-label="Window presets">
			{#each presets as preset (preset.label)}
				<Button variant="ghost" size="sm" onclick={() => onPreset(preset)}>{preset.label}</Button>
			{/each}
		</div>
	{/if}

	<span class="mx-1 h-5 w-px bg-border" aria-hidden="true"></span>
	<Button variant="ghost" size="sm" onclick={onReset}><RotateCcwIcon />Reset</Button>
	{@render children?.()}
</div>
