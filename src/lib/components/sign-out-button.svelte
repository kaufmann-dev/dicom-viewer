<script lang="ts">
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import { authClient } from '#lib/auth-client.js';
	import { Button } from '#lib/components/ui/button/index.js';

	let { role }: { role: 'admin' | 'viewer' } = $props();

	let pending = $state(false);

	async function adminSignOut() {
		pending = true;
		// Ends the local session and redirects through the provider's end-session endpoint.
		await authClient.signOut({ callbackURL: '/' });
	}
</script>

{#if role === 'admin'}
	<Button variant="ghost" size="sm" disabled={pending} onclick={adminSignOut} aria-label="Sign out">
		<LogOutIcon /><span class="hidden sm:inline">Sign out</span>
	</Button>
{:else}
	<form method="POST" action="/logout">
		<Button type="submit" variant="ghost" size="sm" aria-label="Sign out"
			><LogOutIcon /><span class="hidden sm:inline">Sign out</span></Button
		>
	</form>
{/if}
