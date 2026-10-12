import type { PDFDocumentLoadingTask, PDFPageProxy, RenderTask } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export type { PDFDocumentLoadingTask, PDFPageProxy };

let library: Promise<typeof import('pdfjs-dist')> | null = null;

function pdfjs() {
	library ??= import('pdfjs-dist').then((lib) => {
		lib.GlobalWorkerOptions.workerSrc = workerUrl;
		return lib;
	});
	return library;
}

/**
 * Starts loading the PDF of a PDF item; `destroy()` on the task frees the document. PDF.js draws
 * the pages itself, so documents show inside the page on every device, without the browser's PDF
 * viewer and its download button.
 */
export async function openPdf(
	instanceId: string,
	onProgress?: (loaded: number, total: number) => void
): Promise<PDFDocumentLoadingTask> {
	const { getDocument } = await pdfjs();
	const task = getDocument({ url: `/api/files/${instanceId}/pdf` });
	if (onProgress) {
		task.onProgress = ({ loaded, total }: { loaded: number; total: number }) =>
			onProgress(loaded, total);
	}
	return task;
}

/** Renders a page at `scale` (CSS pixels per PDF point), sharp on high-density screens. */
export function renderPage(
	page: PDFPageProxy,
	canvas: HTMLCanvasElement,
	scale: number
): RenderTask {
	const ratio = window.devicePixelRatio || 1;
	const viewport = page.getViewport({ scale: scale * ratio });
	canvas.width = Math.floor(viewport.width);
	canvas.height = Math.floor(viewport.height);
	return page.render({ canvas, viewport });
}
