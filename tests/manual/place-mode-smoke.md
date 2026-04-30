# Place Mode Smoke Test

3D click-to-place behavior is not unit-testable; run this against a deploy that
exposes a page consuming the `placeMode` prop on `SplatViewer` (added in T06's
tent edit form). Until T06 lands, you can validate the controller in isolation
by temporarily wiring `placeMode={true}` on the existing `EventViewPage` viewer
and watching the console / cursor.

## Prerequisites

- Featured event has a real splat URL that resolves (placeholder splat is fine).
- Browser DevTools console open.

## Cursor + listener wiring

- [ ] **Mount the viewer with `placeMode={false}`** → cursor stays the OrbitControls default (`grab` / `grabbing`); no hover or click callbacks fire.
- [ ] **Toggle `placeMode={true}`** → cursor changes to `crosshair` once the splat has loaded (`sceneReady`).
- [ ] **Toggle `placeMode={false}` again** → cursor reverts to whatever it was before (no leftover `crosshair`).

## Hover

- [ ] **Move the cursor across the splat surface** with `placeMode={true}` → `onPlaceHover` fires with `{x, y, z}` world coordinates that change smoothly as the cursor moves.
- [ ] **Move the cursor off the splat** (e.g. into the sky / background) → `onPlaceHover` fires with `null`.
- [ ] **Coordinates are stable** — small cursor movements yield small coordinate changes (no jitter, no NaN).

## Click

- [ ] **Click on the splat surface** → `onPlaceClick` fires once with the world coordinates of the hit.
- [ ] **Click off the splat** (sky / background) → `onPlaceClick` does NOT fire (`hits[0]` was undefined).
- [ ] **Coordinates from click match the last hover** at that position (within float precision).

## Coexistence with OrbitControls

- [ ] **Drag with the mouse** → camera still orbits; `onPlaceClick` should NOT fire after a drag (browsers suppress `click` after a drag on the same element). If a drag DOES fire `onPlaceClick`, file a follow-up to add tap-vs-drag detection (the marker click path already does this with a 6 px / 500 ms threshold).
- [ ] **Pinch / scroll-zoom** → camera zooms; no place callbacks fire.
- [ ] **Right-click drag** → camera pans; no place callbacks fire.

## Disposal

- [ ] **Unmount the viewer while in place mode** → no console errors, no leftover listeners (verified via React DevTools "Components → unmount" and a quick `getEventListeners(canvas)` in the console after unmount).
- [ ] **Toggle `placeMode` off then on again** → controller is recreated cleanly; previous hover state cleared (a final `onPlaceHover(null)` fires on disposal of the old controller).

## Console

- [ ] **No `console.error`** during any of the above.
- [ ] **No "raycast is not a function"** type errors — confirms Spark's `SplatMesh.raycast()` API is intact in the installed version.

## Sign-off

When all green:

> Place-mode smoke test passed against deploy `<URL>` at `<timestamp>` by `<name>`. T05 ready to merge.
