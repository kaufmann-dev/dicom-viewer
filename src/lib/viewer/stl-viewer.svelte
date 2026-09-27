<script lang="ts">
	import { onMount } from 'svelte';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import {
		Box3,
		Color,
		DirectionalLight,
		HemisphereLight,
		Mesh,
		MOUSE,
		MeshStandardMaterial,
		PerspectiveCamera,
		Scene,
		Sphere,
		Vector3,
		WebGLRenderer
	} from 'three';
	import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
	import { STLLoader } from 'three/addons/loaders/STLLoader.js';
	import { Button } from '$lib/components/ui/button';
	import { Progress } from '$lib/components/ui/progress';
	import { MOUSE_HINTS_3D } from './mouse-hints';

	let { instanceId }: { instanceId: string } = $props();

	let container: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let phase: 'loading' | 'ready' | 'error' = $state('loading');
	let progress = $state(0);
	let wireframe = $state(false);

	let resetView = () => {};
	let setWireframe: (value: boolean) => void = () => {};

	onMount(() => {
		const renderer = new WebGLRenderer({ antialias: true, canvas });
		renderer.setPixelRatio(window.devicePixelRatio);

		const scene = new Scene();
		scene.background = new Color(0x000000);
		scene.add(new HemisphereLight(0xffffff, 0x444444, 1.2));
		const camera = new PerspectiveCamera(40, 1, 0.1, 10_000);
		const headlight = new DirectionalLight(0xffffff, 1.6);
		camera.add(headlight);
		scene.add(camera);

		// STL models exported from DICOM use patient coordinates, where +Z is superior. OrbitControls
		// reads camera.up once at construction, so it must be set before creating the controls.
		camera.up.set(0, 0, 1);
		const controls = new OrbitControls(camera, renderer.domElement);
		// Match the Cornerstone 3D view: middle button pans, right button zooms.
		controls.mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.PAN, RIGHT: MOUSE.DOLLY };
		const material = new MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.6, metalness: 0 });
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
			const distance = bounds.radius / Math.sin((camera.fov * Math.PI) / 360);
			camera.near = distance / 100;
			camera.far = distance * 100;
			camera.position.copy(bounds.center).add(new Vector3(0, -distance, distance * 0.35));
			controls.target.copy(bounds.center);
			camera.updateProjectionMatrix();
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
				geometry.computeVertexNormals();
				const mesh = new Mesh(geometry, material);
				scene.add(mesh);
				bounds = new Box3().setFromObject(mesh).getBoundingSphere(new Sphere());
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
	class="flex shrink-0 flex-wrap items-center gap-1 border-b px-2 py-1"
	role="toolbar"
	aria-label="Model tools"
>
	<Button variant="ghost" size="sm" onclick={() => resetView()}><RotateCcwIcon />Reset view</Button>
	<Button
		variant={wireframe ? 'default' : 'ghost'}
		size="sm"
		aria-pressed={wireframe}
		onclick={() => {
			wireframe = !wireframe;
			setWireframe(wireframe);
		}}
	>
		Wireframe
	</Button>
</div>
<p class="shrink-0 border-b px-3 py-1 text-xs text-muted-foreground pointer-coarse:hidden">
	{MOUSE_HINTS_3D}
</p>

<div class="relative min-h-0 flex-1 bg-black">
	<div class="h-full w-full overflow-hidden" bind:this={container}>
		<canvas class="block" bind:this={canvas} aria-label="3D model"></canvas>
	</div>
	{#if phase !== 'ready'}
		<div class="absolute inset-0 flex items-center justify-center px-4 text-sm text-neutral-200">
			{#if phase === 'error'}
				<p role="alert">This model could not be loaded. Reload the page to try again.</p>
			{:else}
				<div class="w-full max-w-xs text-center" role="status">
					<p>Loading model…</p>
					<Progress class="mt-3" value={progress} max={100} />
				</div>
			{/if}
		</div>
	{/if}
</div>
