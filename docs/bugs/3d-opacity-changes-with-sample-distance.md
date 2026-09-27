# 3D opacity changes while rotating or moving the threshold slider

- Fixed: 2026-09-27 22:24:08 CEST (+0200)
- Commit at fix time: 4097eafdfdb79c405a9d97c536ce7281ff92f32e

## Symptom

In the CT 3D view, the rendering looked more or less transparent (as if the HU threshold had
moved) while the mouse button was held on the view or while the threshold slider was being moved.
After releasing, the look changed again. The first render after loading was also more opaque than
correct.

## Root cause

vtk.js and Cornerstone's `vtkStreamingOpenGLVolumeMapper` correct the opacity table for the ray
sample distance (`1 - (1 - a) ^ (sampleDistance / scalarOpacityUnitDistance)`), but cache the
resulting texture by the opacity function's MTime only (`getTransferFunctionsHash`). Changing the
sample distance through `setProperties({ sampleDistanceMultiplier })`, which
`adaptiveVolumeQuality` does on every interaction, does not rebuild the table. The table stayed
corrected for whatever sample distance was active when the opacity function last changed, so coarse
renders were too transparent and fine renders after a coarse rebuild too opaque.

Confirmed in the browser: holding the mouse (3× sampling) made the unmodified app visibly more
transparent. Calling `getScalarOpacity(0).modified()` and re-rendering on an unmodified page changed
the idle image to the same look the fixed app shows. With the fix, a forced rebuild leaves both
the initial render and the render after moving the slider pixel-identical.

## Changes

- `src/lib/viewer/adaptive-volume-quality.ts`: `setInteractive` calls `modified()` on the volume
  actor's scalar opacity function before changing the sample distance, so the table is rebuilt for
  the new distance.
- `AGENTS.md`: documents the caching behavior next to the `adaptiveVolumeQuality` note.
