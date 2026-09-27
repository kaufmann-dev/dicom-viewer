import type { Types } from '@cornerstonejs/core';

/** Ray step while rotating, panning or zooming, relative to the default (half the voxel spacing). */
const INTERACTIVE_SAMPLE_DISTANCE = 3;
const IDLE_SAMPLE_DISTANCE = 1;
/** Wheel zoom has no end event; full quality returns after this pause. */
const SETTLE_MS = 200;

/**
 * Renders a 3D volume viewport with coarse ray sampling while the user interacts with it and at
 * full quality once they stop. `interact` does the same for changes made outside the viewport,
 * such as dragging a slider.
 */
export function adaptiveVolumeQuality(
	element: HTMLElement,
	getViewport: () => Types.IVolumeViewport | undefined
): { interact: () => void; destroy: () => void } {
	let interactive = false;
	let timer: ReturnType<typeof setTimeout> | undefined;

	function setInteractive(value: boolean) {
		if (value === interactive) return;
		interactive = value;
		// Cornerstone re-renders the viewport after changing the sample distance.
		getViewport()?.setProperties({
			sampleDistanceMultiplier: value ? INTERACTIVE_SAMPLE_DISTANCE : IDLE_SAMPLE_DISTANCE
		});
	}

	function settle(delay: number) {
		clearTimeout(timer);
		timer = setTimeout(() => setInteractive(false), delay);
	}

	function onPointerDown() {
		clearTimeout(timer);
		setInteractive(true);
		window.addEventListener('pointerup', onPointerUp);
		window.addEventListener('pointercancel', onPointerUp);
	}

	function onPointerUp() {
		window.removeEventListener('pointerup', onPointerUp);
		window.removeEventListener('pointercancel', onPointerUp);
		settle(0);
	}

	function interact() {
		setInteractive(true);
		settle(SETTLE_MS);
	}

	element.addEventListener('pointerdown', onPointerDown, { capture: true });
	element.addEventListener('wheel', interact, { capture: true, passive: true });

	return {
		interact,
		destroy() {
			clearTimeout(timer);
			element.removeEventListener('pointerdown', onPointerDown, { capture: true });
			element.removeEventListener('wheel', interact, { capture: true });
			window.removeEventListener('pointerup', onPointerUp);
			window.removeEventListener('pointercancel', onPointerUp);
		}
	};
}
