# Visitor Smoke Test

Run this against the latest Vercel preview / production deploy before every release.
Each step should succeed without console errors.

## Prerequisites

- DB has at least 1 published, featured event with ≥ 1 tent + ≥ 1 category.
- Splat URL on the featured event resolves (or fall back to placeholder works).
- Browser DevTools console open to catch any errors.

## Visitor flow

- [ ] **Open `/`** → featured event loads, splat renders within ~10s, markers visible (count matches DB tent count for that event).
- [ ] **Click a marker** → side panel slides in (right side on desktop ≥768 px, bottom sheet on mobile). Tent name, category badge, description, address, and any social-link buttons appear.
- [ ] **URL updates to `/<event-slug>/tent/<tent-slug>`** when a marker is clicked.
- [ ] **Click the same marker again** → panel closes, URL reverts to `/<event-slug>`.
- [ ] **Click ✕ in panel** → same as above.
- [ ] **Click another marker** → panel updates with that tent's data, URL reflects new slug.

## Search

- [ ] **Type a tent name fragment** in the top-bar search → dropdown shows up to 8 matches.
- [ ] **No results** shows the localized "no matches" message.
- [ ] **Click a result** → camera selects that tent (panel opens), search input clears, URL updates.

## Category filter

- [ ] **Click a category chip** → markers in other categories dim to ~40 % opacity, the chip highlights.
- [ ] **Click multiple chips** → all selected categories' markers stay bright.
- [ ] **Click "Alle anzeigen" / "Show all"** → all markers full opacity, no chips highlighted.

## Language

- [ ] **Click `EN`** → top-bar labels, side-panel labels, search placeholder all switch to English. Tent description switches to `description_en` if present, else falls back to `description_de`.
- [ ] **Click `DE`** → all labels back to German.
- [ ] **Reload the page** → language preference persists (saved to localStorage as `kunstmeile_lang`).
- [ ] **Open `/?lang=en`** in a private window → loads in English (URL param overrides localStorage).

## Permalinks

- [ ] **Copy a `/<event>/tent/<slug>` URL** and paste in a new private window → side panel pre-opens with that tent's data.
- [ ] **Open `/<nonexistent-slug>`** → handled gracefully (loads featured event or shows "not found" — no crash).

## 3D interaction

- [ ] **Drag with mouse / 1-finger touch** → camera orbits the splat center, with smooth damping.
- [ ] **Scroll wheel / pinch** → camera zooms.
- [ ] **Right-click drag / 2-finger drag** → camera pans.
- [ ] **Drag through a marker (>6 px movement)** → marker is NOT selected (drag-vs-tap detection).
- [ ] **Quick tap on a marker** → marker IS selected.

## Performance

- [ ] **First paint** < 2 s on 4G mobile (Lighthouse mobile run).
- [ ] **Splat fully visible** < 10 s on 4G mobile (one-time download is large; subsequent loads use HTTP cache).
- [ ] **Marker click → panel open** < 100 ms.
- [ ] **Search debounce** ~200 ms (instant feel without flicker).

## Console

- [ ] **No `console.error`** at any point.
- [ ] **No unhandled promise rejections.**
- [ ] **No "Worker error" or "WebGL: INVALID_OPERATION"** during normal interaction.

## Mobile-specific (Phase 1 best-effort, hardened in A4)

- [ ] **Top bar wraps** without horizontal scroll on 375 px viewport.
- [ ] **Side panel becomes a bottom sheet** on viewports < 768 px.
- [ ] **Touch gestures** work (tap, drag, pinch).

## Marker angle-switching (PR B — sign-post billboard)

- [ ] Top-down view (orbit camera up to look almost straight down): markers render as flat numbered circles
- [ ] Tilt the camera toward horizontal (drag down): when you cross ~45° from up, markers swap to **vertical sign-posts** (post + disc with the number on it)
- [ ] Tilt back up: markers swap back to flat circles
- [ ] Slow tilts at the threshold should NOT flicker (hysteresis ±0.03 rad)
- [ ] Tap a sign-post (post or disc) → side panel opens (recursive hit-test still works)

## Sign-off

When all green:

> Smoke test passed against deploy `<URL>` at `<timestamp>` by `<name>`. Ready to release.
