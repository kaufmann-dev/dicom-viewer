# Repository Instructions

## Build and Verification

```bash
pnpm install
pnpm dev                          # Needs PostgreSQL and .env (see README.md)
pnpm check                        # Run before finishing Svelte/TS changes
pnpm lint                         # Prettier + ESLint
pnpm test                         # Vitest, Node environment, src/**/*.spec.ts
pnpm build                        # Run before finishing routing, server, Vite or dependency changes
pnpm db:generate --name <name>    # After editing src/lib/server/db/schema.ts
```

- Generate migrations with Drizzle Kit and commit `drizzle/`. Do not use `db:push`. `hooks.server.ts` applies migrations at server start.
- Regenerate `src/lib/server/db/auth.schema.ts` with `pnpm dlx auth@latest generate --config src/lib/server/auth.ts --output src/lib/server/db/auth.schema.ts` after changing Better Auth plugins. Do not hand-edit it.
- Viewer changes need a browser check. The dev server and `node build` bundle Cornerstone differently, so verify both after changing `vite.config.ts` or Cornerstone versions.

## Data and Privacy

- Never commit real DICOM, STL or report data, and never copy it into fixtures. Tests build synthetic DICOM with `writeDicom`/`ctSlice` from `src/lib/server/dicom/test-utils.ts`.
- `DATA_DIR` holds the uploaded files and PostgreSQL holds only metadata. Resolve stored paths only through `resolveStoredPath` in `src/lib/server/storage.ts`.

## Access Model

- Admin = any Better Auth (OIDC) session. The OIDC provider is the only admission control, so do not add email or claim allowlists.
- Viewers use passcode sessions (`src/lib/server/viewer-auth.ts`). A session is valid only while both the session and its passcode are unexpired and exist.
- Every endpoint that returns item data or files must check `canAccessItem` in `src/lib/server/access.ts`. Answer with 404 instead of 403 so item existence is not revealed.
- Downloads (`/api/files/download`) go through `downloadRows`/`canDownload` in `access.ts`. Admins can always download. Viewers can download only when their passcode has `allowDownload`. Archive naming lives in `src/lib/server/download.ts`.
- `hooks.server.ts` guards `/admin`, `/api/admin`, `/view` and `/api/files`. New routes under other prefixes need their own checks.
- Uploads must send `Content-Type: application/octet-stream`. SvelteKit drops bodies that have no content type.

## Cornerstone3D (v5)

- `@cornerstonejs/dicom-image-loader` is excluded from Vite pre-bundling, and its CommonJS codec dependencies are listed in `optimizeDeps.include`. Keep both lists in sync when upgrading.
- `pnpm-workspace.yaml` patches vtk.js (`patches/`) to handle rays parallel to the volume faces without dividing by zero. Without it, Chrome on ANGLE/NVIDIA OpenGL renders the 3D view and all MPR views black. Upstream fix: Kitware/vtk-js#3701. Drop the patch once Cornerstone ships a vtk.js release that contains it.
- vtk.js pulls in `xmlbuilder2`, which needs `events`. `pnpm-workspace.yaml` provides it through `packageExtensions`.
- Register instances with `prefetchPart10Instance` before building volumes. The wadouri loader reads naturalized metadata; `dataSetCacheManager` does not feed it.
- Stack viewports do not apply the stored VOI automatically. Use `defaultVoiRange`.
- The 3D viewport is attached only after the volume has finished loading, so it is not re-rendered for every slice.
- 3D rendering cost scales with ray sample distance × canvas pixels. `adaptiveVolumeQuality` renders with 3× coarser sampling while the pointer is down, the wheel moves or its `interact()` is called (threshold slider), then renders once at full quality. The mapper caches its sample-distance-corrected opacity table by opacity function MTime only, so `adaptiveVolumeQuality` calls `modified()` on the opacity function whenever it changes the sample distance; otherwise coarse and fine renders show different opacity. Volume textures are 16-bit (`preferSizeOverAccuracy`).
- The CT 3D threshold slider moves the selected preset's opacity and color points along the HU axis (`shiftPreset` in `src/lib/viewer/volume-threshold.ts`) and applies it with `utilities.applyPreset`, because `setProperties({ preset })` is typed for preset names only.
- 3D views rotate as turntables around patient superior (+Z in DICOM/STL coordinates): `TurntableRotateTool` (a `BaseTool`, so it does not reset the camera on resize like the trackball) for Cornerstone, and `camera.up` set before constructing `OrbitControls` for STL. Do not switch back to `TrackballRotateTool`, which accumulates roll.
- Cornerstone does not render DICOM overlay planes. `DicomOverlayTool` draws them in stack viewports, and `thumbnails.ts` draws them onto thumbnails after resetting the canvas transform, which Cornerstone's CPU renderer leaves in image pixel coordinates. Both read group 6000 from the naturalized metadata (`metaData.get('naturalized', imageId)`) through `overlayPlanes` in `src/lib/viewer/dicom-overlay.ts`. Siemens protocol pages have empty pixel data and keep their text in the overlay. Map overlay positions through the viewport's `getImageData()`, not `utilities.imageToWorldCoords`, which fails for images without position and orientation.
- Overview thumbnails are rendered in the browser once and stored as `<instance>.thumb.jpg` next to the item's middle instance, flagged by `instance.thumbnail` (`src/lib/server/thumbnails.ts`). Only admins store them (`PUT /api/admin/thumbnails/[instanceId]`): the upload panel renders the ones `finalize` reports missing, and the overview backfills the rest for admins. Everyone else loads them from `/api/files/[instanceId]/thumbnail` and renders locally only while one is missing.
- Overview thumbnails (`src/lib/viewer/thumbnails.ts`) use `loadImageToCanvas` with `useCPURendering: true`. Its GPU path shares one hidden rendering engine and stalls under concurrent calls. STL thumbnails (`stl-thumbnail.ts`) share one hidden three.js renderer and use the viewer's scene and initial camera from `stl-scene.ts`.
- On mobile widths (`IsMobile`), the volume viewer hides the "All" layout and shows one pane at a time. Single panes disable the crosshairs tool, which also removes its lines. `RenderingEngine.resize` does nothing while a render frame is pending, so layout changes resize on the next animation frame.
- Touch: one finger runs the selected primary tool (the "Scroll" tool replaces the wheel), and two fingers always pinch-zoom through `PinchZoomTool`. The zoom tool is configured with `pinchToZoom: false`; otherwise its one-finger drag pans.
- PDFs render with PDF.js through `src/lib/viewer/pdf.ts`, never the browser's PDF viewer: it does not display embedded PDFs on Android, shows only the first page on iOS, and its download button would bypass `allowDownload`. In PDF.js 6, `page.render` takes `canvas` and the loading task's `destroy()` frees the document.
- Photos and PDF files are recognized by content (`src/lib/server/file-types.ts`) and accepted only as individual files. `ingestFile` skips them when the upload name has a folder, because patient CDs carry viewer icons and manuals. Never accept SVG, since it is served from this origin. DICOM Encapsulated PDFs keep their `.dcm` (downloads stay DICOM) and store the extracted `<instance>.pdf` next to it. `/api/files/[instanceId]/pdf` serves the PDF of every `pdf` item through `pdfPath`.
- Without WebGL (disabled, or blocked by Chrome after GPU crashes), volume items open in the stack viewer, which Cornerstone renders on the CPU, and the STL viewer shows a message. An exception thrown while a viewer mounts becomes SvelteKit's 500 page, so catch it inside the viewer.
- Use unique IDs for rendering engines and tool groups for each mount. On destroy, clean up with `cache.purgeCache()` and `clearInstanceMetadata()`.

## Svelte and UI

- This is Svelte 5 in runes mode. Use `$props`, `$state` and `$derived`, and use `$effect` only to sync external libraries. Use `onclick`-style attributes, snippets and `{@attach}`, not legacy syntax.
- Use the Svelte MCP (`list-sections`, `get-documentation`, `svelte-autofixer`) when writing Svelte code.
- Import shadcn-svelte components from `#lib/components/ui/`. Never run the shadcn CLI to add or remove components. Those files are excluded from Prettier and ESLint.
- Build single-choice option groups with `#lib/components/segmented`, not raw `ToggleGroup`. It keeps one option selected and gives every group the same look.
- Give controls that act like form fields (segments, toggles, select-style menu triggers) the input surface from `#lib/components/field-surface`, not the outline button style. Selected items use the primary fill, including on hover.
- Keep the visual rules in `src/routes/layout.css`: softly rounded corners, muted cool-neutral surfaces instead of pure black/white, and shadcn's default subtle shadows and transitions. Imaging viewports stay pure black.
- Build internal links with `resolve()` from `$app/paths`, as ESLint enforces.
- The login page (`src/routes/+page.svelte`) is the only public page. The Imprint and Privacy links (`#lib/components/legal-links.svelte`) appear there and on the viewer overview (`/view`, `/view/projects/[projectId]`), not on item views or in `/admin`.
