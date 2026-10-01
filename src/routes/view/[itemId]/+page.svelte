<script lang="ts">
	import { resolve } from '$app/paths';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import { Button } from '#lib/components/ui/button/index.js';
	import { downloadHref } from '#lib/download.js';
	import { itemTypeText } from '#lib/item-kind.js';
	import { formatDicomDate } from '#lib/sr.js';
	import DicomStackViewer from '#lib/viewer/dicom-stack-viewer.svelte';
	import DicomVolumeViewer from '#lib/viewer/dicom-volume-viewer.svelte';
	import SrReport from '#lib/viewer/sr-report.svelte';
	import StlViewer from '#lib/viewer/stl-viewer.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const item = $derived(data.item);
	const study = $derived(
		[formatDicomDate(item.studyDate), item.studyDescription].filter(Boolean).join(' · ')
	);
</script>

<svelte:head><title>{item.label} · Scans</title></svelte:head>

<div class="flex shrink-0 items-center gap-3 border-b px-2 py-2">
	<Button
		variant="ghost"
		size="icon"
		href={resolve('/view/projects/[projectId]', { projectId: item.projectId })}
		aria-label="Back to all scans"
	>
		<ArrowLeftIcon />
	</Button>
	<div class="min-w-0">
		<h1 class="truncate text-sm font-semibold">{item.label}</h1>
		<p class="truncate text-xs text-muted-foreground">
			{[itemTypeText(item), study].filter(Boolean).join(' · ')}
		</p>
	</div>
	{#if data.canDownload}
		<Button
			variant="ghost"
			size="icon"
			class="ml-auto"
			href={downloadHref({ item: item.id })}
			download
			aria-label="Download"
			title="Download"
		>
			<DownloadIcon />
		</Button>
	{/if}
</div>

{#key item.id}
	{#if item.kind === 'stl'}
		<StlViewer instanceId={data.instanceIds[0]} />
	{:else if item.kind === 'sr'}
		<SrReport reports={data.reports} />
	{:else if item.volume}
		<DicomVolumeViewer instanceIds={data.instanceIds} modality={item.modality} />
	{:else}
		<DicomStackViewer instanceIds={data.instanceIds} modality={item.modality} />
	{/if}
{/key}
