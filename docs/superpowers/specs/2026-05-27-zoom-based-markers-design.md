# Zoom-based Marker Detail — Design Spec

**Date:** 2026-05-27
**Status:** Approved, ready for implementation plan
**Author:** Brainstorm session with Jan
**Target branch:** `feat/map-pivot` (post-pivot iteration on the open PR #28)
**Parent spec:** [2026-05-26-map-pivot-design.md](2026-05-26-map-pivot-design.md)

## Context and rationale

The public map (`MapView`) and the admin map editor (`TentMapEditor`) currently render every tent as a 28×28 px DivIcon with the stand number inside. At the first event's default zoom (18) and at Lat 53°, that marker is ~10m wide on screen. Stands at Kunstmeile sit 3–4m apart in places, so the markers visibly overlap at the default view — see the screenshot Jan shared 2026-05-27 (three nearby markers around the Mühlenteich crowding each other).

The fix is zoom-dependent marker detail: at low zoom render a small colored dot (no number) for spatial density; at high zoom render the full 28×28 marker with the stand number. A single threshold drives the switch.

## Out of scope

- Marker clustering (leaflet.markercluster) — overkill for ~100 stands.
- Smooth icon scaling with continuous zoom — threshold-switch is visually clearer.
- Per-event configurable threshold or detail-zoom level. Hardcoded constant is enough; if a future event needs tuning, adding a per-event column is ~30min of work later.
- New UI affordance to explain "zoom in for numbers" — discoverability is acceptable via the standard zoom-in interaction.
- Changes to the admin editor's current red pin behavior. Only the green neighbor markers in `TentMapEditor` participate in the threshold swap (see MP-Z-005).

## Locked decisions

| # | Decision |
|---|----------|
| MP-Z-001 | Strategy: **threshold-based icon swap** (dot below threshold, full marker at/above). |
| MP-Z-002 | Threshold lives as a **hardcoded constant** in `src/lib/map.ts`: `MARKER_DETAIL_ZOOM = 20`. No DB column, no admin UI. |
| MP-Z-003 | Dot variant: **12×12 px, category-colored, 2px white border**. No display_number rendered. Tooltip is passed via the Leaflet `Marker` component's `title` prop (HTML attribute on the rendered icon `<div>`) — same pattern already used by the green neighbor markers in `TentMapEditor`. |
| MP-Z-004 | Both variants are **clickable** with identical behavior: marker click → `selectTentBySlug(tent.slug)` (public viewer) or no-op (admin editor neighbors). |
| MP-Z-005 | Admin `TentMapEditor` participates: **green neighbor markers** swap to small green dots below threshold. The **red pin** (current tent being placed) stays at full size always — admins need it prominent regardless of zoom. |
| MP-Z-006 | Threshold rationale: at Lat 53° (Sittensen), zoom 20 gives 0.09 m/px, so a 28px marker is 2.5m wide — fits the 3–4m stand spacing. Zoom 19 (5m) would still overlap; zoom 21 (1.3m) is overkill for default density. |

## Sizing math (for reviewer reference)

At Lat 53° (the Kunstmeile venue):

| Zoom | m/px | 28px marker | 12px dot |
|------|------|-------------|----------|
| 18 (default) | 0.36 | 10m | 4.3m |
| 19 | 0.18 | 5m | 2.2m |
| 20 (threshold) | 0.09 | **2.5m** | 1.1m |
| 21 | 0.045 | 1.3m | 0.5m |
| 22 (maxZoom) | 0.022 | 0.6m | 0.3m |

At the default view (zoom 18), users see dots — clear at typical 3–4m spacing. One zoom-in to 19 keeps dots but more separated. Two zoom-ins to 20 reveal stand numbers. Above zoom 19 OSM tiles are scaled (already in place from a prior smoke fix), but that does not affect marker sizing.

## Data model changes

**None.** No migration, no `events` column, no `tents` column.

## Code architecture changes

### Files modified

| Path | Change |
|---|---|
| `src/lib/map.ts` | Export `MARKER_DETAIL_ZOOM = 20`. |
| `src/components/TentMarker.tsx` | Add `variant?: 'dot' \| 'full'` prop (default `'full'` for backwards compatibility). `'dot'` renders a 12×12 category-colored circle with white border and no inner content. `'full'` is the current behavior (28×28 with display number). |
| `src/components/MapView.tsx` | Track current zoom via a child `<ZoomTracker />` subcomponent that uses `useMapEvents({ zoomend })`. Derive `variant` per marker from `currentZoom >= MARKER_DETAIL_ZOOM`. Memoize each marker's `L.divIcon` keyed on `(displayNumber, color, variant)` to avoid re-creating icons on unrelated re-renders. |
| `src/components/TentMapEditor.tsx` | Same `<ZoomTracker />` pattern. The `neighborIcon` helper accepts a `variant` argument and renders a 12×12 green dot below threshold, full numbered green badge at/above threshold. The red current-pin stays at its existing 24×24 size unconditionally. |

### New units

| Path | Responsibility |
|---|---|
| `src/components/ZoomTracker.tsx` (or inlined as a private subcomponent within MapView and TentMapEditor) | Tiny utility component using `useMapEvents` to call `onChange(zoom)` whenever the map's zoom settles. No DOM output. |

If `ZoomTracker` ends up duplicated in MapView and TentMapEditor without divergence, lift it to a shared component. Otherwise keep it inlined per file — it's ~10 lines.

### Files NOT modified

- `src/pages/public/EventViewPage.tsx` — no API change to MapView's outer prop shape.
- `src/pages/admin/TentEditPage.tsx` — no API change to TentEditForm.
- `src/components/TentEditForm.tsx` — no API change to TentMapEditor.
- DB migrations, types, locale files, EventSettings UI.

## Behavior

### Public viewer (`MapView`)

- On mount, `currentZoom` is initialized from the `zoom` prop (the event's `default_zoom`).
- Below `MARKER_DETAIL_ZOOM` (zoom < 20): every placed tent renders as a 12×12 dot. Click opens the SidePanel via existing `onMarkerClick(tent)`.
- At or above `MARKER_DETAIL_ZOOM` (zoom ≥ 20): every placed tent renders as the current 28×28 marker with `display_number` inside.
- Category filter and "no-coords" banner unaffected.
- Tile-zoom levels above 19 keep their existing pixelated-but-navigable behavior.

### Admin editor (`TentMapEditor`)

- The **current tent's red pin** (24×24) renders at all zoom levels.
- The **green neighbor markers** swap variant on the same threshold: 12×12 green dot below 20, 20×20 numbered green badge at/above. Both variants stay non-interactive (`interactive={false}`, `keyboard={false}`).
- Click-to-place and drag behavior on the red pin remain identical.

## Test strategy

Per workflow memory, pure helpers get TDD; component behavior gets RTL+Vitest with react-leaflet mocked.

### New unit tests

1. `tests/unit/lib/map.test.ts` — assert `MARKER_DETAIL_ZOOM === 20` and is exported. (One assertion, two lines.)
2. `tests/unit/components/TentMarker.test.tsx` — new test cases:
   - `variant='dot'` renders a 12×12 div with the supplied background color, no inner text.
   - `variant='full'` (or no variant) still renders the existing 28×28 layout.
3. `tests/unit/components/MapView.test.tsx` — extend the existing react-leaflet mock so the `MapContainer` exposes a `useMapEvents`-style hook that lets the test fire a synthetic `zoomend` with a given zoom value. The new test fires `zoomend` at zoom 19, asserts the rendered markers carry the dot variant (e.g., `data-variant="dot"` on the marker stub); fires `zoomend` at zoom 20, asserts the full variant returns.

### Existing tests to update

- `tests/unit/components/MapView.test.tsx` — the mock's `MapContainer` may need to accept and expose the initial zoom for the assertion above.
- `tests/unit/components/TentMapEditor.test.tsx` — neighbor markers' variant assertion analogous to MapView.

### Manual smoke

Add to `tests/manual/map-public-smoke.md`:
- [ ] At default zoom (zoom 18), all tents show as small colored dots without numbers.
- [ ] Zooming in once (to zoom 19) keeps them as dots.
- [ ] Zooming in twice (to zoom 20) shows full numbered markers.
- [ ] Filter by category still hides/shows the dots correctly.
- [ ] Clicking a dot opens the SidePanel for that tent.

Add to `tests/manual/map-admin-editor-smoke.md`:
- [ ] At default zoom, neighbor tents (green) appear as small green dots without numbers.
- [ ] Zooming in past threshold shows green numbered badges.
- [ ] The red current-pin stays the same size regardless of zoom.

## Migration plan

Single feature branch commit on the still-open `feat/map-pivot` branch (PR #28 still in iteration). The commit fits the existing chunk size; no new PR is needed.

Conventional Commit suggestion:
```
feat(viewer): zoom-based marker detail — dots below z=20, numbers at/above

At Lat 53° the 28×28 numbered marker is ~10m wide at the event's
default zoom (18), and stands sit 3–4m apart in clusters, so markers
overlap. Below MARKER_DETAIL_ZOOM=20 each marker renders as a 12×12
category-colored dot; at zoom ≥ 20 the full numbered badge returns.
Applies to both the public MapView and the admin TentMapEditor's
green neighbor markers; the red current-pin stays prominent.
```

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| `useMapEvents({ zoomend })` mock setup in tests is fiddly | Already established pattern in `TentMapEditor.test.tsx` for `useMapEvents({ click })`. Reuse the same `globalThis.__mapZoomHandler` trick. |
| `L.divIcon` recreated every render causes flicker | Memoize via `useMemo` keyed on `(displayNumber, color, variant)`. Already the established pattern in `TentMapEditor.tsx`'s `pinIcon`. |
| Threshold of 20 forces users to zoom twice from default 18 to see numbers | Acceptable: that's the explicit UX goal. The default-zoom event setting (added in T4 of the pivot) lets the admin tune this if 18 turns out wrong for a different venue. |
| Dots are too small to tap reliably on mobile (target size < 44×44 per WCAG 2.5.5) | The dot is visual; Leaflet's hit area can be expanded via `iconAnchor` / `iconSize` mismatch or by adding invisible padding. Implementation should give the dot a 24×24 effective hit area (visual circle 12×12, transparent padding around it). |

## Acceptance criteria

The feature ships when:

1. `pnpm test:run`, `pnpm type-check`, `pnpm lint` are all clean on the branch tip.
2. The public map at `/events/<slug>` opens at the event's `default_zoom` and renders dots if below 20, full markers if 20+.
3. Crossing the threshold via the zoom buttons swaps marker variants without flicker or stale icons.
4. Clicking a dot opens the SidePanel exactly as clicking a full marker does today.
5. The admin tent-edit map shows green dots below threshold and green badges at/above. The red current-pin is unchanged.
6. Tap targets on dots are at least 24×24 effective hit area on touch devices.
7. The Vercel preview rebuild against the same PR (#28) passes the new entries in `map-public-smoke.md` and `map-admin-editor-smoke.md`.

## Open questions

None — all design decisions are locked. Implementation can proceed via the writing-plans skill.
