<script lang="ts">
	let { text }: { text: string } = $props();
</script>

<p
	class="shrink-0 border-b bg-background px-3 py-1 text-xs text-muted-foreground pointer-coarse:hidden"
>
	{text}
</p>
