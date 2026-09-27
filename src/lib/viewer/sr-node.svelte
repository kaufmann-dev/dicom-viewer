<script lang="ts">
	import type { SrNode } from '$lib/sr';
	import SrField from './sr-field.svelte';
	import SrNodeView from './sr-node.svelte';

	let {
		node,
		depth,
		parentName = '',
		nested = false
	}: {
		node: SrNode;
		depth: number;
		parentName?: string;
		/** Modifies the preceding item, e.g. the intent of a reported procedure. */
		nested?: boolean;
	} = $props();

	const isText = $derived(node.valueType === 'TEXT');
	/** Report sections usually repeat their heading as the name of their text. */
	const showName = $derived(Boolean(node.name) && node.name !== parentName);
	const isProse = $derived(isText && (!showName || (node.value?.length ?? 0) > 80));
</script>

{#if node.valueType === 'CONTAINER'}
	<section class="mt-6">
		{#if node.name}
			<h3 class={depth === 0 ? 'text-base font-semibold' : 'text-sm font-semibold'}>{node.name}</h3>
		{/if}
		<div class={depth > 0 ? 'border-l pl-4' : ''}>
			{#each node.children as child, i (i)}
				<SrNodeView node={child} depth={depth + 1} parentName={node.name} />
			{/each}
		</div>
	</section>
{:else if isProse}
	<div class="mt-3">
		{#if showName}<p class="text-xs text-muted-foreground">{node.name}</p>{/if}
		<p class="mt-1 whitespace-pre-line">{node.value}</p>
	</div>
{:else}
	<dl>
		<SrField
			label={node.name}
			value={`${node.value ?? ''}${node.unit ? `\u00a0${node.unit}` : ''}`}
			{nested}
		/>
	</dl>
	{#each node.children as child, i (i)}
		<SrNodeView node={child} depth={depth + 1} nested />
	{/each}
{/if}
