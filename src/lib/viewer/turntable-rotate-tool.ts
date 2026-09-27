import { getEnabledElement, type Types } from '@cornerstonejs/core';
import { BaseTool, type Types as ToolTypes } from '@cornerstonejs/tools';

/** Patient superior direction in DICOM (LPS) world coordinates. */
const WORLD_UP: Types.Point3 = [0, 0, 1];
const RADIANS_PER_PIXEL = 0.006;
/** Pitch stays just short of straight up/down, where the view-up vector is undefined. */
const MAX_PITCH = (89 * Math.PI) / 180;

/**
 * Turntable rotation for 3D viewports: horizontal drags turn around the patient's superior axis
 * and vertical drags tilt, so the view can never roll. The camera is rebuilt from yaw and pitch
 * on every move. Render quality during interaction is handled by `adaptiveVolumeQuality`.
 */
export class TurntableRotateTool extends BaseTool {
	static toolName = 'TurntableRotate';

	constructor(toolProps: ToolTypes.PublicToolProps = {}) {
		super(toolProps, { supportedInteractionTypes: ['Mouse', 'Touch'], configuration: {} });
	}

	mouseDragCallback(evt: ToolTypes.EventTypes.MouseDragEventType) {
		this.rotate(evt);
	}

	touchDragCallback(evt: ToolTypes.EventTypes.TouchDragEventType) {
		this.rotate(evt);
	}

	private rotate(
		evt: ToolTypes.EventTypes.MouseDragEventType | ToolTypes.EventTypes.TouchDragEventType
	) {
		const { element, deltaPoints } = evt.detail;
		const [dx, dy] = deltaPoints.canvas;
		if (dx === 0 && dy === 0) return;

		const { viewport } = getEnabledElement(element)!;
		const { focalPoint, position } = viewport.getCamera();
		if (!focalPoint || !position) return;

		const offset = [0, 1, 2].map((i) => position[i] - focalPoint[i]);
		const distance = Math.hypot(...offset);
		if (distance === 0) return;

		const yaw = Math.atan2(offset[1], offset[0]) - dx * RADIANS_PER_PIXEL;
		const pitch = Math.max(
			-MAX_PITCH,
			Math.min(MAX_PITCH, Math.asin(offset[2] / distance) + dy * RADIANS_PER_PIXEL)
		);

		const normal: Types.Point3 = [
			Math.cos(pitch) * Math.cos(yaw),
			Math.cos(pitch) * Math.sin(yaw),
			Math.sin(pitch)
		];
		const upDot = WORLD_UP[0] * normal[0] + WORLD_UP[1] * normal[1] + WORLD_UP[2] * normal[2];
		const up = WORLD_UP.map((w, i) => w - upDot * normal[i]);
		const upLength = Math.hypot(...up);

		viewport.setCamera({
			focalPoint,
			position: [
				focalPoint[0] + normal[0] * distance,
				focalPoint[1] + normal[1] * distance,
				focalPoint[2] + normal[2] * distance
			],
			viewUp: [up[0] / upLength, up[1] / upLength, up[2] / upLength]
		});
		viewport.render();
	}
}
