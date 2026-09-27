<script lang="ts">
	import { onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import SearchIcon from '@lucide/svelte/icons/search';
	import ItemTile from '$lib/components/viewer/item-tile.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { NativeSelect, NativeSelectOption } from '$lib/components/ui/native-select';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import {
		formatStudyDate,
		isDoseReport,
		matchesFilter,
		type CatalogItem,
		type CatalogProject,
		type ItemFilter
	} from '$lib/catalog';
	import type { PageProps, Snapshot } from './$types';

	let { data }: PageProps = $props();

	let query = $state('');
	let filter: ItemFilter = $state('all');

	export const snapshot: Snapshot<{ query: string; filter: ItemFilter }> = {
		capture: () => ({ query, filter }),
		restore: (value) => {
			query = value.query;
			filter = value.filter;
		}
	};

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			void import('$lib/viewer/thumbnails').then((m) => m.releaseThumbnailData());
		}
	});

	const FILTERS: { value: ItemFilter; label: string }[] = [
		{ value: 'all', label: 'All' },
		{ value: 'volumes', label: '3D volumes' },
		{ value: 'images', label: 'Images' },
		{ value: 'reports', label: 'Reports' },
		{ value: 'models', label: '3D models' }
	];

	const project = $derived(data.catalog.find((p) => p.id === page.params.projectId)!);
	const projectItems = $derived(project.studies.flatMap((s) => s.items));
	const availableFilters = $derived(
		FILTERS.filter((f) => f.value === 'all' || projectItems.some((i) => matchesFilter(i, f.value)))
	);
	const activeFilter = $derived(availableFilters.some((f) => f.value === filter) ? filter : 'all');

	const studies = $derived.by(() => {
		const words = query.toLowerCase().split(/\s+/).filter(Boolean);
		return project.studies
			.map((study) => {
				const studyText = [study.description, formatStudyDate(study.date), study.date]
					.join(' ')
					.toLowerCase();
				const items = study.items.filter((item) => {
					if (!matchesFilter(item, activeFilter)) return false;
					const text = `${studyText} ${item.label} ${item.modality ?? ''}`.toLowerCase();
					return words.every((w) => text.includes(w));
				});
				return {
					...study,
					tiles: items.filter((i) => i.kind !== 'sr'),
					reports: items.filter((i) => i.kind === 'sr' && !isDoseReport(i)),
					doseReports: items.filter(isDoseReport)
				};
			})
			.filter((s) => s.tiles.length + s.reports.length + s.doseReports.length > 0);
	});

	function summary(p: CatalogProject): string {
		const visits = p.studies.filter((s) => s.key !== 'stl').length;
		const dates = p.studies.map((s) => s.date).filter((d): d is string => Boolean(d));
		const range = dates.length
			? [formatStudyDate(dates.at(-1)!), formatStudyDate(dates[0])]
					.filter((d, i, all) => all.indexOf(d) === i)
					.join(' – ')
			: '';
		return [`${visits} ${visits === 1 ? 'visit' : 'visits'}`, range].filter(Boolean).join(' · ');
	}

	function itemHref(item: CatalogItem) {
		return resolve('/view/[itemId]', { itemId: item.id });
	}
</script>

<svelte:head><title>{project.name} · Scans</title></svelte:head>

<div class="flex min-h-0 flex-1">
	{#if data.catalog.length > 1}
		<nav class="hidden w-72 shrink-0 overflow-y-auto border-r py-4 md:block" aria-label="Projects">
			<p class="px-4 pb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
				Projects
			</p>
			<ul>
				{#each data.catalog as p (p.id)}
					{@const current = p.id === project.id}
					<li>
						<a
							href={resolve('/view/projects/[projectId]', { projectId: p.id })}
							aria-current={current ? 'page' : undefined}
							class={[
								'block border-l-2 px-4 py-2.5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
								current ? 'border-foreground bg-muted' : 'border-transparent hover:bg-muted'
							]}
						>
							<span class="block truncate text-sm font-medium">{p.name}</span>
							<span class="block truncate text-xs text-muted-foreground">{summary(p)}</span>
						</a>
					</li>
				{/each}
			</ul>
		</nav>
	{/if}

	<main class="min-w-0 flex-1 overflow-y-auto">
		<div class="mx-auto w-full max-w-5xl px-4 py-6 md:px-8">
			{#if data.catalog.length > 1}
				<label class="mb-4 block md:hidden">
					<span class="sr-only">Project</span>
					<NativeSelect
						class="w-full"
						value={project.id}
						onchange={(e) =>
							goto(resolve('/view/projects/[projectId]', { projectId: e.currentTarget.value }), {
								keepFocus: true
							})}
					>
						{#each data.catalog as p (p.id)}
							<NativeSelectOption value={p.id}>{p.name}</NativeSelectOption>
						{/each}
					</NativeSelect>
				</label>
			{/if}

			<h1 class="text-2xl font-semibold tracking-tight">{project.name}</h1>
			<p class="mt-1 text-sm text-muted-foreground">{summary(project)}</p>

			<div class="mt-6 flex flex-wrap items-center gap-3">
				<div class="relative w-full sm:w-72">
					<SearchIcon
						class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
						aria-hidden="true"
					/>
					<Input
						type="search"
						bind:value={query}
						placeholder="Search by date, body part or name"
						aria-label="Search scans"
						class="pl-8"
					/>
				</div>
				{#if availableFilters.length > 2}
					<ToggleGroup.Root
						type="single"
						size="sm"
						value={activeFilter}
						onValueChange={(value) => (filter = (value || 'all') as ItemFilter)}
						aria-label="Show"
						class="flex-wrap"
					>
						{#each availableFilters as f (f.value)}
							<ToggleGroup.Item value={f.value}>{f.label}</ToggleGroup.Item>
						{/each}
					</ToggleGroup.Root>
				{/if}
			</div>

			{#if studies.length === 0}
				<div class="mt-12 text-center">
					<p class="text-sm text-muted-foreground">Nothing matches your search.</p>
					<Button
						variant="outline"
						size="sm"
						class="mt-3"
						onclick={() => {
							query = '';
							filter = 'all';
						}}>Show everything</Button
					>
				</div>
			{/if}

			{#each studies as study (study.key)}
				<section class="mt-10 border-t pt-6" aria-labelledby="study-{study.key}">
					<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
						<h2 id="study-{study.key}" class="text-lg font-semibold">
							{formatStudyDate(study.date) || study.description || 'Study'}
						</h2>
						{#if study.date && study.description}
							<span class="text-sm text-muted-foreground">{study.description}</span>
						{/if}
					</div>

					{#if study.tiles.length}
						<div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
							{#each study.tiles as item (item.id)}
								<ItemTile {item} />
							{/each}
						</div>
					{/if}

					{#if study.reports.length || study.doseReports.length}
						<div class="mt-4 flex flex-wrap gap-2">
							{#each study.reports as report (report.id)}
								<Button variant="outline" size="sm" href={itemHref(report)}>
									<FileTextIcon />{report.label === 'Report' ? 'Radiology report' : report.label}
								</Button>
							{/each}
							{#each study.doseReports as report, i (report.id)}
								<Button
									variant="ghost"
									size="sm"
									class="text-muted-foreground"
									href={itemHref(report)}
								>
									<FileTextIcon />Dose report{study.doseReports.length > 1 ? ` ${i + 1}` : ''}
								</Button>
							{/each}
						</div>
					{/if}
				</section>
			{/each}
		</div>
	</main>
</div>
