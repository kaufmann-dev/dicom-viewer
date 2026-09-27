<script lang="ts">
	import type { SrDocument } from '$lib/sr';
	import SrNodeView from './sr-node.svelte';

	let { reports }: { reports: SrDocument[] } = $props();
</script>

<div class="min-h-0 flex-1 overflow-y-auto">
	<div class="mx-auto w-full max-w-3xl px-4 py-8">
		{#if reports.length === 0}
			<p class="text-sm text-muted-foreground">This report has no readable content.</p>
		{/if}
		{#each reports as report, i (i)}
			<article class={i > 0 ? 'mt-12 border-t pt-8' : ''}>
				<h2 class="text-xl font-semibold tracking-tight">{report.title}</h2>
				{#if report.header.length}
					<dl class="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
						{#each report.header as entry, j (j)}
							<dt class="text-muted-foreground">{entry.label}</dt>
							<dd>{entry.value}</dd>
						{/each}
					</dl>
				{/if}
				{#each report.content as node, j (j)}
					<SrNodeView {node} depth={0} />
				{/each}
			</article>
		{/each}
	</div>
</div>
