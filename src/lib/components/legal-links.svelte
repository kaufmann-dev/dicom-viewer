<script lang="ts">
	import type { ClassValue } from 'svelte/elements';

	let { class: className }: { class?: ClassValue } = $props();
</script>

<footer class={['flex justify-center gap-6 px-4 py-6 text-xs text-muted-foreground', className]}>
	<a
		class="hover:text-foreground hover:underline"
		href="https://legal.kaufmann.dev/imprint?site=scans.kaufmann.dev">Imprint</a
	>
	<a
		class="hover:text-foreground hover:underline"
		href="https://legal.kaufmann.dev/privacy?site=scans.kaufmann.dev">Privacy</a
	>
</footer>
