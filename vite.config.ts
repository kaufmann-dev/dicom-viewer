import { defineConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			// Public origin behind the reverse proxy; used for CSRF checks and request URLs.
			paths: { origin: process.env.ORIGIN || undefined }
		})
	],
	// Cornerstone's DICOM image loader ships its own web workers and WASM codecs.
	optimizeDeps: {
		exclude: ['@cornerstonejs/dicom-image-loader'],
		// CommonJS dependencies of the excluded loader still need pre-bundling in dev.
		include: [
			'@cornerstonejs/dicom-image-loader > dicom-parser',
			'@cornerstonejs/dicom-image-loader > @cornerstonejs/codec-charls/decodewasmjs',
			'@cornerstonejs/dicom-image-loader > @cornerstonejs/codec-libjpeg-turbo-8bit/decodewasmjs',
			'@cornerstonejs/dicom-image-loader > @cornerstonejs/codec-libjxl/decodewasmjs',
			'@cornerstonejs/dicom-image-loader > @cornerstonejs/codec-openjpeg/decodewasmjs',
			'@cornerstonejs/dicom-image-loader > @cornerstonejs/codec-openjph/wasmjs'
		]
	},
	worker: {
		format: 'es'
	},
	test: {
		expect: { requireAssertions: true },
		environment: 'node',
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
