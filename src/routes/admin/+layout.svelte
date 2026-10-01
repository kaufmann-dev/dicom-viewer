<script lang="ts">
	import EyeIcon from '@lucide/svelte/icons/eye';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import SignOutButton from '#lib/components/sign-out-button.svelte';
	import ThemeToggle from '#lib/components/theme-toggle.svelte';
	import { Button } from '#lib/components/ui/button/index.js';

	let { children } = $props();

	const tabs = [
		{ href: '/admin/projects', label: 'Projects' },
		{ href: '/admin/passcodes', label: 'Passcodes' }
	] as const;
</script>

<div class="flex min-h-dvh flex-col">
	<header class="flex h-14 shrink-0 items-center gap-2 border-b px-4">
		<a href={resolve('admin')} class="mr-4 hidden font-semibold tracking-tight sm:inline">Scans</a>

		<nav class="mr-auto flex gap-1" aria-label="Admin">
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

		<Button variant="ghost" size="sm" href={resolve('view')} aria-label="Viewer">
			<EyeIcon />
			<span class="hidden sm:inline">Viewer</span>
		</Button>
		<ThemeToggle />
		<SignOutButton role="admin" />
	</header>
	<main class="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
		{@render children()}
	</main>
</div>
