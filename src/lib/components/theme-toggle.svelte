<script lang="ts">
	import MoonIcon from '@lucide/svelte/icons/moon';
	import SunIcon from '@lucide/svelte/icons/sun';
	import { toggleMode } from 'mode-watcher';
	import { Button } from '$lib/components/ui/button';
</script>

<Button variant="ghost" size="icon" onclick={toggleMode} aria-label="Toggle dark mode">
	<SunIcon class="dark:hidden" />
	<MoonIcon class="hidden dark:block" />
</Button>
