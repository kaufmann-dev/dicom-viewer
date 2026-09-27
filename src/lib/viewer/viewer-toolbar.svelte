<script lang="ts">
	import type { Snippet } from 'svelte';
	import CrosshairIcon from '@lucide/svelte/icons/crosshair';
	import HandIcon from '@lucide/svelte/icons/hand';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import RulerIcon from '@lucide/svelte/icons/ruler';
	import SunMediumIcon from '@lucide/svelte/icons/sun-medium';
	import ZoomInIcon from '@lucide/svelte/icons/zoom-in';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { ButtonGroup } from '$lib/components/ui/button-group';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { PRIMARY_TOOL_LABELS, type PrimaryTool, type WindowPreset } from './cornerstone';
	import { MOUSE_HINTS_2D, PRIMARY_TOOL_HINTS } from './mouse-hints';

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

	const id = $props.id();

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
	<Tooltip.Provider>
		<div class="flex items-center gap-1" role="group" aria-label="Left mouse button tool">
			{#each tools as tool (tool)}
				{@const Icon = icons[tool]}
				<Tooltip.Root>
					<Tooltip.Trigger
						class={buttonVariants({ variant: primary === tool ? 'default' : 'ghost', size: 'sm' })}
						aria-pressed={primary === tool}
						onclick={() => onPrimary(tool)}
					>
						<Icon />
						<span class="hidden md:inline">{PRIMARY_TOOL_LABELS[tool]}</span>
						<span class="sr-only md:hidden">{PRIMARY_TOOL_LABELS[tool]}</span>
					</Tooltip.Trigger>
					<Tooltip.Content>{PRIMARY_TOOL_HINTS[tool]}</Tooltip.Content>
				</Tooltip.Root>
			{/each}
		</div>
	</Tooltip.Provider>

	{#if presets.length && onPreset}
		<span class="mx-1 h-5 w-px bg-border max-sm:hidden" aria-hidden="true"></span>
		<div class="flex items-center gap-2">
			<span class="text-xs text-muted-foreground" id="{id}-window-label">Window</span>
			<ButtonGroup aria-labelledby="{id}-window-label">
				{#each presets as preset (preset.label)}
					<Button variant="outline" size="sm" onclick={() => onPreset(preset)}
						>{preset.label}</Button
					>
				{/each}
			</ButtonGroup>
		</div>
	{/if}

	<span class="mx-1 h-5 w-px bg-border max-sm:hidden" aria-hidden="true"></span>
	<Button variant="ghost" size="sm" onclick={onReset}><RotateCcwIcon />Reset</Button>
	{@render children?.()}
</div>
<p
	class="shrink-0 border-b bg-background px-3 py-1 text-xs text-muted-foreground pointer-coarse:hidden"
>
	{PRIMARY_TOOL_HINTS[primary]} · {MOUSE_HINTS_2D}
</p>
