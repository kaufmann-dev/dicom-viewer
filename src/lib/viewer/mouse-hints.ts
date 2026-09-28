import type { PrimaryTool } from './cornerstone';

/** What a left-button drag does with each primary tool. */
export const PRIMARY_TOOL_HINTS: Record<PrimaryTool, string> = {
	crosshairs: 'Left-click or drag: move crosshairs',
	scroll: 'Left-drag up / down: scroll slices',
	windowLevel: 'Left-drag: brightness / contrast',
	pan: 'Left-drag: pan',
	zoom: 'Left-drag: zoom',
	length: 'Left-drag from point to point: measure distance'
};

export const MOUSE_HINTS_2D = 'Middle-drag: pan · Right-drag: zoom · Wheel: scroll slices';
export const MOUSE_HINTS_3D = 'Left-drag: rotate · Middle-drag: pan · Right-drag or wheel: zoom';
