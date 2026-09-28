<script lang="ts">
	let {
		label,
		value,
		nested = false
	}: { label: string; value: string; nested?: boolean } = $props();
</script>

<div
	class="grid grid-cols-1 gap-x-6 border-b py-2 text-sm sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
>
	<dt class={['text-muted-foreground', nested && 'pl-4']}>{label}</dt>
	<dd class={['break-words', nested && 'pl-4 sm:pl-0']}>{value}</dd>
</div>
