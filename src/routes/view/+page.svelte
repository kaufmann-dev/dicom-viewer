<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Scans</title></svelte:head>

<p class="px-4 py-16 text-center text-sm text-muted-foreground">
	{#if data.role === 'admin'}
		No scans yet. Create a project and upload files in <a class="underline" href={resolve('/admin')}
			>Admin</a
		>.
	{:else}
		No scans are shared with this passcode.
	{/if}
</p>
