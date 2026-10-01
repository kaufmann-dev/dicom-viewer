<script lang="ts">
	import { resolve } from '$app/paths';
	import SignOutButton from '#lib/components/sign-out-button.svelte';
	import ThemeToggle from '#lib/components/theme-toggle.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const until = $derived(
		data.accessUntil
			? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
					data.accessUntil
				)
			: null
	);
</script>

<div class="flex h-dvh flex-col">
	<header class="flex h-14 shrink-0 items-center gap-2 border-b px-4">
		<a href={resolve('view')} class="mr-auto font-semibold tracking-tight">Scans</a>

		{#if until}
			<span class="hidden text-xs text-muted-foreground sm:inline">Access until {until}</span>
		{/if}
		{#if data.role === 'admin'}
			<Button variant="ghost" size="sm" href={resolve('admin')}>Admin</Button>
		{/if}
		<ThemeToggle />
		<SignOutButton role={data.role} />
	</header>
	<div class="flex min-h-0 flex-1 flex-col">
		{@render children()}
	</div>
</div>
