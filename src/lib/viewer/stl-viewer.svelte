<script lang="ts">
	import { onMount } from 'svelte';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import { Mesh, MOUSE, Sphere, Vector3, WebGLRenderer } from 'three';
	import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
	import { STLLoader } from 'three/addons/loaders/STLLoader.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Progress } from '#lib/components/ui/progress/index.js';
	import { FIELD_SURFACE } from '#lib/components/field-surface.js';
	import { Toggle } from '#lib/components/ui/toggle/index.js';
	import { cn } from '#lib/utils.js';
	import MouseHint from './mouse-hint.svelte';
	import { MOUSE_HINTS_3D } from './mouse-hints';
	import { addModel, createStlScene, frameModel } from './stl-scene';

	let { instanceId }: { instanceId: string } = $props();

	let container: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let phase: 'loading' | 'ready' | 'error' | 'no-webgl' = $state('loading');
	let progress = $state(0);
	let wireframe = $state(false);

	let resetView = () => {};
	let setWireframe: (value: boolean) => void = () => {};

	onMount(() => {
		let renderer: WebGLRenderer;
		try {
			renderer = new WebGLRenderer({ antialias: true, canvas });
		} catch (error) {
			// Thrown when WebGL is disabled or the browser has blocked it after GPU crashes.
			console.error(error);
			phase = 'no-webgl';
			return;
		}
		renderer.setPixelRatio(window.devicePixelRatio);

		const { scene, camera, material } = createStlScene();
		const controls = new OrbitControls(camera, renderer.domElement);
		// Match the Cornerstone 3D view: middle button pans, right button zooms.
		controls.mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.PAN, RIGHT: MOUSE.DOLLY };
		// Slower than the default, matching the Cornerstone 3D view.
		controls.rotateSpeed = 0.6;
		let bounds = new Sphere(new Vector3(), 1);
		let frame = 0;

		function render() {
			renderer.render(scene, camera);
		}

		function resize() {
			const { clientWidth, clientHeight } = container;
			if (!clientWidth || !clientHeight) return;
			renderer.setSize(clientWidth, clientHeight);
			camera.aspect = clientWidth / clientHeight;
			camera.updateProjectionMatrix();
			render();
		}

		resetView = () => {
			frameModel(camera, bounds);
			controls.target.copy(bounds.center);
			controls.update();
			render();
		};

		setWireframe = (value) => {
			material.wireframe = value;
			render();
		};

		controls.addEventListener('change', () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(render);
		});

		const resizeObserver = new ResizeObserver(resize);
		resizeObserver.observe(container);

		new STLLoader().load(
			`/api/files/${instanceId}`,
			(geometry) => {
				bounds = addModel(scene, geometry, material);
				resize();
				resetView();
				phase = 'ready';
			},
			(event) => {
				if (event.lengthComputable) progress = (event.loaded / event.total) * 100;
			},
			(error) => {
				console.error(error);
				phase = 'error';
			}
		);

		return () => {
			cancelAnimationFrame(frame);
			resizeObserver.disconnect();
			controls.dispose();
			scene.traverse((object) => {
				if (object instanceof Mesh) object.geometry.dispose();
			});
			material.dispose();
			renderer.dispose();
		};
	});
</script>

<div
	class="flex shrink-0 flex-wrap items-center gap-2 border-b bg-background px-2 py-1.5"
	role="toolbar"
	aria-label="Model tools"
>
	<Toggle
		size="sm"
		class={cn(
			FIELD_SURFACE,
			'aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary aria-pressed:hover:text-primary-foreground'
		)}
		bind:pressed={
			() => wireframe,
			(value) => {
				wireframe = value;
				setWireframe(value);
			}
		}
	>
		Wireframe
	</Toggle>
	<Button variant="ghost" size="sm" class="sm:ml-auto" onclick={() => resetView()}>
		<RotateCcwIcon />Reset view
	</Button>
</div>
<MouseHint text={MOUSE_HINTS_3D} />

<div class="relative min-h-0 flex-1 bg-black">
	<div class="h-full w-full overflow-hidden" bind:this={container}>
		<canvas class="block" bind:this={canvas} aria-label="3D model"></canvas>
	</div>
	{#if phase !== 'ready'}
		<div class="absolute inset-0 flex items-center justify-center px-4 text-sm text-neutral-200">
			{#if phase === 'error'}
				<p role="alert">This model could not be loaded. Reload the page to try again.</p>
			{:else if phase === 'no-webgl'}
				<p role="alert">
					This browser cannot display 3D models right now. Turn on hardware acceleration or restart
					the browser, then reload the page.
				</p>
			{:else}
				<div class="w-full max-w-xs text-center" role="status">
					<p>Loading model…</p>
					<Progress class="mt-3" value={progress} max={100} />
				</div>
			{/if}
		</div>
	{/if}
</div>
