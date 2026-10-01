<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import { ModeWatcher } from 'mode-watcher';
	import { Toaster } from '#lib/components/ui/sonner/index.js';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Scans</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<ModeWatcher />
<Toaster position="bottom-center" />
{@render children()}
