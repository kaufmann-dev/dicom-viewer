<script lang="ts">
	import type { ToggleGroup as ToggleGroupPrimitive } from 'bits-ui';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import { cn } from '$lib/utils';

	let { class: className, ...restProps }: ToggleGroupPrimitive.ItemProps = $props();
</script>

<ToggleGroup.Item
	class={cn(
		'bg-muted group-data-[spacing=0]/toggle-group:px-3 hover:bg-muted/60 data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground',
		className
	)}
	{...restProps}
/>
