/** False when WebGL is disabled or the browser has blocked it, e.g. after GPU crashes. */
export function webglAvailable(): boolean {
	const gl = document.createElement('canvas').getContext('webgl2');
	gl?.getExtension('WEBGL_lose_context')?.loseContext();
	return gl !== null;
}
