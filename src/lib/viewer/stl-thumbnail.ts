import { Mesh, WebGLRenderer } from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { addModel, createStlScene, frameModel } from './stl-scene';

let renderer: WebGLRenderer | undefined;

/**
 * Renders the STL model to a data URL from the viewer's initial camera position. One hidden
 * renderer serves all thumbnails, since browsers limit the number of WebGL contexts.
 */
export async function renderStlThumbnail(instanceId: string, size: number): Promise<string> {
	// Throws without WebGL, before the model is downloaded.
	renderer ??= new WebGLRenderer({ antialias: true });
	const geometry = await new STLLoader().loadAsync(`/api/files/${instanceId}`);
	renderer.setSize(size, size, false);
	const { scene, camera, material } = createStlScene();
	try {
		frameModel(camera, addModel(scene, geometry, material));
		renderer.render(scene, camera);
		return renderer.domElement.toDataURL('image/jpeg', 0.85);
	} finally {
		scene.traverse((object) => {
			if (object instanceof Mesh) object.geometry.dispose();
		});
		material.dispose();
	}
}
