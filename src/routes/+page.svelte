<script lang="ts">
	import { enhance } from '$app/forms';
	import { authClient, OIDC_PROVIDER_ID } from '$lib/auth-client';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Spinner } from '$lib/components/ui/spinner';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let submitting = $state(false);
	let redirecting = $state(false);
	let adminError = $state('');

	async function adminSignIn() {
		redirecting = true;
		adminError = '';
		const { error } = await authClient.signIn.social({
			provider: OIDC_PROVIDER_ID,
			callbackURL: data.returnTo,
			errorCallbackURL: '/?error=oidc'
		});
		if (error) {
			redirecting = false;
			adminError = 'Admin sign-in is unavailable right now.';
		}
	}
</script>

<div class="flex min-h-dvh flex-col">
	<main class="flex flex-1 items-center justify-center px-4 py-12">
		<div class="w-full max-w-sm">
			<h1 class="text-2xl font-semibold tracking-tight">Scans</h1>
			<p class="mt-1 text-sm text-muted-foreground">Enter the passcode you received.</p>

			<form
				method="POST"
				class="mt-8 flex flex-col gap-3"
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						await update();
						submitting = false;
					};
				}}
			>
				<Label for="code">Passcode</Label>
				<Input
					id="code"
					name="code"
					required
					autocomplete="off"
					autocapitalize="characters"
					spellcheck={false}
					class="h-11 font-mono tracking-widest uppercase"
					aria-invalid={form?.message ? 'true' : undefined}
					aria-describedby={form?.message ? 'code-error' : undefined}
				/>
				{#if form?.message}
					<p id="code-error" class="text-sm text-destructive" role="alert">{form.message}</p>
				{/if}
				<Button type="submit" class="h-11" disabled={submitting}>
					{#if submitting}<Spinner />{/if}
					View scans
				</Button>
			</form>

			<div class="my-8 flex items-center gap-3 text-xs text-muted-foreground uppercase">
				<span class="h-px flex-1 bg-border"></span>or<span class="h-px flex-1 bg-border"></span>
			</div>

			<Button variant="outline" class="h-11 w-full" disabled={redirecting} onclick={adminSignIn}>
				{#if redirecting}<Spinner />{/if}
				Admin sign in
			</Button>
			{#if adminError || data.oidcError}
				<p class="mt-3 text-sm text-destructive" role="alert">
					{adminError || 'Admin sign-in failed. Try again.'}
				</p>
			{/if}
		</div>
	</main>
	<footer class="flex justify-center gap-6 px-4 py-6 text-xs text-muted-foreground">
		<a
			class="hover:text-foreground hover:underline"
			href="https://legal.kaufmann.dev/imprint?site=scans.kaufmann.dev">Imprint</a
		>
		<a
			class="hover:text-foreground hover:underline"
			href="https://legal.kaufmann.dev/privacy?site=scans.kaufmann.dev">Privacy</a
		>
	</footer>
</div>
