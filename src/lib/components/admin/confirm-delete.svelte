<script lang="ts">
	import { enhance } from '$app/forms';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { buttonVariants } from '$lib/components/ui/button';

	let {
		action,
		id,
		title,
		description,
		label = 'Delete'
	}: { action: string; id: string; title: string; description: string; label?: string } = $props();

	let open = $state(false);
</script>

<AlertDialog.Root bind:open>
	<AlertDialog.Trigger
		class={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
		aria-label={label}
	>
		<Trash2Icon />
	</AlertDialog.Trigger>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{title}</AlertDialog.Title>
			<AlertDialog.Description>{description}</AlertDialog.Description>
		</AlertDialog.Header>
		<form
			method="POST"
			{action}
			use:enhance={() =>
				async ({ update }) => {
					open = false;
					await update();
				}}
		>
			<input type="hidden" name="id" value={id} />
			<AlertDialog.Footer>
				<AlertDialog.Cancel type="button">Cancel</AlertDialog.Cancel>
				<AlertDialog.Action type="submit" variant="destructive">{label}</AlertDialog.Action>
			</AlertDialog.Footer>
		</form>
	</AlertDialog.Content>
</AlertDialog.Root>
