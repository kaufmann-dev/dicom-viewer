import { metaData, utilities, type Types } from '@cornerstonejs/core';
import { AnnotationDisplayTool, type Types as ToolTypes } from '@cornerstonejs/tools';
import { overlayBitmap, overlayPlanes, type OverlayPlane } from './dicom-overlay';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Draws the image's DICOM overlay plane (for example the text of Siemens protocol pages, whose
 * pixel data is empty) above stack viewports. Cornerstone does not render overlays itself.
 * Overlays are independent of window/level and follow pan and zoom.
 */
export class DicomOverlayTool extends AnnotationDisplayTool {
	static toolName = 'DicomOverlay';

	/** Overlay bitmaps as data URLs, keyed by image ID. */
	private bitmaps = new Map<string, { plane: OverlayPlane; url: string }[]>();

	constructor(toolProps: ToolTypes.PublicToolProps = {}) {
		super(toolProps, { supportedInteractionTypes: [], configuration: {} });
	}

	renderAnnotation(
		{ viewport }: Types.IEnabledElement,
		svgDrawingHelper: ToolTypes.SVGDrawingHelper
	): boolean {
		const stack = viewport as Types.IStackViewport;
		const imageId = stack.getCurrentImageId();
		// The viewport's own geometry, which has defaults for images without position/orientation
		// (e.g. secondary captures), unlike utilities.imageToWorldCoords.
		const imageData = stack.getImageData()?.imageData;
		if (!imageId || !imageData) return false;
		let overlays = this.bitmaps.get(imageId);
		if (!overlays) {
			overlays = overlayPlanes(metaData.get('naturalized', imageId)).map((plane) => ({
				plane,
				url: overlayBitmap(plane).toDataURL('image/png')
			}));
			this.bitmaps.set(imageId, overlays);
		}

		overlays.forEach(({ plane, url }, i) => {
			// Pixel indices address pixel centers; the plane spans from the outer edges of its corners.
			const [x1, y1] = viewport.worldToCanvas(
				utilities.transformIndexToWorld(imageData, [plane.x - 0.5, plane.y - 0.5, 0])
			);
			const [x2, y2] = viewport.worldToCanvas(
				utilities.transformIndexToWorld(imageData, [
					plane.x + plane.columns - 0.5,
					plane.y + plane.rows - 0.5,
					0
				])
			);
			const key = `${DicomOverlayTool.toolName}-${viewport.id}-${i}`;
			const existing = svgDrawingHelper.getSvgNode(key);
			const node = existing ?? document.createElementNS(SVG_NS, 'image');
			node.setAttribute('href', url);
			node.setAttribute('x', String(Math.min(x1, x2)));
			node.setAttribute('y', String(Math.min(y1, y2)));
			node.setAttribute('width', String(Math.abs(x2 - x1)));
			node.setAttribute('height', String(Math.abs(y2 - y1)));
			node.setAttribute('preserveAspectRatio', 'none');
			node.setAttribute('style', 'pointer-events: none');
			if (existing) svgDrawingHelper.setNodeTouched(key);
			else svgDrawingHelper.appendNode(node, key);
		});
		return overlays.length > 0;
	}
}
