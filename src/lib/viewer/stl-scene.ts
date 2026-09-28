import {
	Box3,
	BufferGeometry,
	Color,
	DirectionalLight,
	HemisphereLight,
	Mesh,
	MeshStandardMaterial,
	PerspectiveCamera,
	Scene,
	Sphere,
	Vector3
} from 'three';

/** Scene, headlight camera and material shared by the STL viewer and STL thumbnails. */
export function createStlScene() {
	const scene = new Scene();
	scene.background = new Color(0x000000);
	scene.add(new HemisphereLight(0xffffff, 0x444444, 1.2));
	const camera = new PerspectiveCamera(40, 1, 0.1, 10_000);
	camera.add(new DirectionalLight(0xffffff, 1.6));
	scene.add(camera);
	// STL models exported from DICOM use patient coordinates, where +Z is superior. OrbitControls
	// reads camera.up once at construction, so it must be set before creating the controls.
	camera.up.set(0, 0, 1);
	const material = new MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.6, metalness: 0 });
	return { scene, camera, material };
}

/** Adds the model to the scene and returns its bounding sphere. */
export function addModel(scene: Scene, geometry: BufferGeometry, material: MeshStandardMaterial) {
	geometry.computeVertexNormals();
	const mesh = new Mesh(geometry, material);
	scene.add(mesh);
	return new Box3().setFromObject(mesh).getBoundingSphere(new Sphere());
}

/** Places the camera in front of the model, slightly above, looking at its center. */
export function frameModel(camera: PerspectiveCamera, bounds: Sphere): void {
	const distance = bounds.radius / Math.sin((camera.fov * Math.PI) / 360);
	camera.near = distance / 100;
	camera.far = distance * 100;
	camera.position.copy(bounds.center).add(new Vector3(0, -distance, distance * 0.35));
	camera.lookAt(bounds.center);
	camera.updateProjectionMatrix();
}
