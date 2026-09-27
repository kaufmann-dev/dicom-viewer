<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import SignOutButton from '$lib/components/sign-out-button.svelte';
	import ThemeToggle from '$lib/components/theme-toggle.svelte';
	import { Button } from '$lib/components/ui/button';

	let { children } = $props();

	const tabs = [
		{ href: '/admin/projects', label: 'Projects' },
		{ href: '/admin/passcodes', label: 'Passcodes' }
	] as const;
</script>

<div class="flex min-h-dvh flex-col">
	<header
		class="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b px-4 py-2 sm:h-14 sm:py-0"
	>
		<a href={resolve('/admin')} class="mr-auto font-semibold tracking-tight sm:mr-4">Scans</a>
		<nav class="order-last flex w-full gap-1 sm:order-none sm:mr-auto sm:w-auto" aria-label="Admin">
			{#each tabs as tab (tab.href)}
				{@const current = page.url.pathname.startsWith(tab.href)}
				<Button
					variant={current ? 'secondary' : 'ghost'}
					size="sm"
					href={resolve(tab.href)}
					aria-current={current ? 'page' : undefined}
				>
					{tab.label}
				</Button>
			{/each}
		</nav>
		<Button variant="ghost" size="sm" href={resolve('/view')}>Viewer</Button>
		<ThemeToggle />
		<SignOutButton role="admin" />
	</header>
	<main class="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
		{@render children()}
	</main>
</div>
