<script lang="ts">
	import type { Snippet } from 'svelte';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ContrastIcon from '@lucide/svelte/icons/contrast';
	import CrosshairIcon from '@lucide/svelte/icons/crosshair';
	import HandIcon from '@lucide/svelte/icons/hand';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import RulerIcon from '@lucide/svelte/icons/ruler';
	import SunMediumIcon from '@lucide/svelte/icons/sun-medium';
	import ZoomInIcon from '@lucide/svelte/icons/zoom-in';
	import { FIELD_SURFACE } from '$lib/components/field-surface';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Segmented from '$lib/components/segmented';
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
		/** Display controls, placed at the right before Reset. */
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
	class="flex shrink-0 flex-wrap items-center gap-2 border-b bg-background px-2 py-1.5"
	role="toolbar"
	aria-label="Viewer tools"
>
	<Tooltip.Provider>
		<Segmented.Root
			size="sm"
			value={primary}
			onValueChange={(value) => onPrimary(value as PrimaryTool)}
			aria-label="Left mouse button tool"
		>
			{#each tools as tool (tool)}
				{@const Icon = icons[tool]}
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<Segmented.Item {...props} value={tool}>
								<Icon />
								<span class="hidden md:inline">{PRIMARY_TOOL_LABELS[tool]}</span>
								<span class="sr-only md:hidden">{PRIMARY_TOOL_LABELS[tool]}</span>
							</Segmented.Item>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content>{PRIMARY_TOOL_HINTS[tool]}</Tooltip.Content>
				</Tooltip.Root>
			{/each}
		</Segmented.Root>
	</Tooltip.Provider>

	{#if presets.length && onPreset}
		<DropdownMenu.Root>
			<DropdownMenu.Trigger
				class={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), FIELD_SURFACE)}
			>
				<ContrastIcon />Window preset<ChevronDownIcon class="text-muted-foreground" />
			</DropdownMenu.Trigger>
			<DropdownMenu.Content class="min-w-60">
				<DropdownMenu.Label>Window presets</DropdownMenu.Label>
				{#each presets as preset (preset.label)}
					<DropdownMenu.Item onSelect={() => onPreset(preset)}>
						{preset.label}
						<DropdownMenu.Shortcut>W {preset.width} · L {preset.center}</DropdownMenu.Shortcut>
					</DropdownMenu.Item>
				{/each}
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	{/if}

	<div class="flex flex-wrap items-center gap-2 sm:ml-auto">
		{@render children?.()}
		<Button variant="ghost" size="sm" onclick={onReset}><RotateCcwIcon />Reset</Button>
	</div>
</div>
<p
	class="shrink-0 border-b bg-background px-3 py-1 text-xs text-muted-foreground pointer-coarse:hidden"
>
	{PRIMARY_TOOL_HINTS[primary]} · {MOUSE_HINTS_2D}
</p>
