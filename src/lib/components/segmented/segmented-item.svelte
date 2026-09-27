<script lang="ts">
	import type { ToggleGroup as ToggleGroupPrimitive } from 'bits-ui';
	import { FIELD_SURFACE } from '$lib/components/field-surface';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import { cn } from '$lib/utils';

	let { class: className, ...restProps }: ToggleGroupPrimitive.ItemProps = $props();
</script>

<ToggleGroup.Item
	class={cn(
		FIELD_SURFACE,
		'not-last:not-data-[state=on]:border-r-border group-data-[spacing=0]/toggle-group:px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary',
		className
	)}
	{...restProps}
/>
