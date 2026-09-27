import { init as coreInit, type Types } from '@cornerstonejs/core';
import {
	init as dicomImageLoaderInit,
	prefetchPart10Instance
} from '@cornerstonejs/dicom-image-loader';
import { utilities as metadataUtilities } from '@cornerstonejs/metadata';
import {
	addTool,
	CrosshairsTool,
	Enums as ToolEnums,
	init as toolsInit,
	LengthTool,
	PanTool,
	StackScrollTool,
	WindowLevelTool,
	ZoomTool,
	type Types as ToolTypes
} from '@cornerstonejs/tools';
import { TurntableRotateTool } from './turntable-rotate-tool';

let initialized = false;

export function initCornerstone(): void {
	if (initialized) return;
	coreInit();
	dicomImageLoaderInit({ maxWebWorkers: Math.min(navigator.hardwareConcurrency || 2, 4) });
	toolsInit();
	for (const tool of [
		WindowLevelTool,
		PanTool,
		ZoomTool,
		StackScrollTool,
		LengthTool,
		CrosshairsTool,
		TurntableRotateTool
	]) {
		addTool(tool);
	}
	initialized = true;
}

export function imageIdFor(instanceId: string): string {
	return `wadouri:${location.origin}/api/files/${instanceId}`;
}

/**
 * Downloads and registers every instance (metadata and compressed frames) so volume geometry
 * is known before the volume is built; decoding then needs no further requests.
 */
export async function prefetchInstances(
	imageIds: string[],
	onProgress: (loaded: number) => void,
	concurrency = 6
): Promise<void> {
	let next = 0;
	let loaded = 0;
	async function worker() {
		while (next < imageIds.length) {
			const imageId = imageIds[next++];
			const response = await fetch(imageId.slice('wadouri:'.length));
			if (!response.ok) throw new Error(`Failed to load ${imageId}: ${response.status}`);
			await prefetchPart10Instance(imageId, await response.arrayBuffer());
			onProgress(++loaded);
		}
	}
	await Promise.all(Array.from({ length: concurrency }, worker));
}

/** Releases parsed DICOM metadata and frame data held for the closed series. */
export function clearInstanceMetadata(): void {
	metadataUtilities.clearCacheData();
}

export type PrimaryTool = 'crosshairs' | 'windowLevel' | 'pan' | 'zoom' | 'length';

export const PRIMARY_TOOL_LABELS: Record<PrimaryTool, string> = {
	crosshairs: 'Crosshairs',
	windowLevel: 'Window / level',
	pan: 'Pan',
	zoom: 'Zoom',
	length: 'Measure'
};

const TOOL_NAMES: Record<PrimaryTool, string> = {
	crosshairs: CrosshairsTool.toolName,
	windowLevel: WindowLevelTool.toolName,
	pan: PanTool.toolName,
	zoom: ZoomTool.toolName,
	length: LengthTool.toolName
};

const { MouseBindings } = ToolEnums;

/** Middle button pans, right button zooms and the wheel scrolls; the left button runs `primary`. */
export function applyToolBindings(
	toolGroup: ToolTypes.IToolGroup,
	tools: PrimaryTool[],
	primary: PrimaryTool
): void {
	for (const tool of tools) {
		const bindings: { mouseButton: number }[] = [];
		if (tool === primary) bindings.push({ mouseButton: MouseBindings.Primary });
		if (tool === 'pan') bindings.push({ mouseButton: MouseBindings.Auxiliary });
		if (tool === 'zoom') bindings.push({ mouseButton: MouseBindings.Secondary });
		if (bindings.length) toolGroup.setToolActive(TOOL_NAMES[tool], { bindings });
		else toolGroup.setToolPassive(TOOL_NAMES[tool]);
	}
}

export function addViewingTools(toolGroup: ToolTypes.IToolGroup, tools: PrimaryTool[]): void {
	for (const tool of tools) toolGroup.addTool(TOOL_NAMES[tool]);
	toolGroup.addTool(StackScrollTool.toolName);
	toolGroup.setToolActive(StackScrollTool.toolName, {
		bindings: [{ mouseButton: MouseBindings.Wheel }]
	});
}

export function add3dTools(toolGroup: ToolTypes.IToolGroup): void {
	toolGroup.addTool(TurntableRotateTool.toolName);
	toolGroup.addTool(PanTool.toolName);
	toolGroup.addTool(ZoomTool.toolName);
	toolGroup.setToolActive(TurntableRotateTool.toolName, {
		bindings: [{ mouseButton: MouseBindings.Primary }]
	});
	toolGroup.setToolActive(PanTool.toolName, {
		bindings: [{ mouseButton: MouseBindings.Auxiliary }]
	});
	toolGroup.setToolActive(ZoomTool.toolName, {
		bindings: [{ mouseButton: MouseBindings.Secondary }, { mouseButton: MouseBindings.Wheel }]
	});
}

export type WindowPreset = { label: string; width: number; center: number };

export const CT_WINDOW_PRESETS: WindowPreset[] = [
	{ label: 'Soft tissue', width: 400, center: 40 },
	{ label: 'Bone', width: 1800, center: 400 },
	{ label: 'Lung', width: 1500, center: -600 },
	{ label: 'Brain', width: 80, center: 40 }
];

export function voiRange({ width, center }: WindowPreset) {
	return { lower: center - width / 2, upper: center + width / 2 };
}

function firstNumber(value: number | number[] | undefined): number | undefined {
	const n = Array.isArray(value) ? value[0] : value;
	return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
}

/** The image's stored window (Window Center/Width), falling back to its pixel value range. */
export function defaultVoiRange(image: Types.IImage): Types.VOIRange {
	const center = firstNumber(image.windowCenter);
	const width = firstNumber(image.windowWidth);
	if (center !== undefined && width)
		return { lower: center - width / 2, upper: center + width / 2 };
	const slope = image.slope ?? 1;
	const intercept = image.intercept ?? 0;
	return {
		lower: image.minPixelValue * slope + intercept,
		upper: image.maxPixelValue * slope + intercept
	};
}
