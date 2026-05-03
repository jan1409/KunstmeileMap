# Viewer Enhancements — Design

**Date:** 2026-05-03
**Status:** Approved (awaiting writing-plans hand-off)
**Scope:** Three independent PRs against `main` for the public viewer (`/event/<slug>` and `/event/<slug>/tent/<slug>`).

## Goals

Three user-flagged enhancements (logged in the phase-status memory as "view-handling enhancements + admin-flow simplifications"):

1. **Filter "hide instead of dim".** Selecting one or more category chips should remove non-matching tents from the map entirely, not merely fade them.
2. **Flyby on tent select + return-to-overview.** Clicking a sign animates the camera toward the tent (≈10 m, slightly tilted) instead of snapping. A floating "Back to overview" button flies back to the per-event saved default whenever the camera is away from it.
3. **Inline "+ Add photos" for authorized users.** When an admin or per-event owner/editor opens a tent's side panel on the public viewer, they see an upload control to add a photo without leaving the page. A "Manage photos →" link deep-links to the existing admin tent-edit page for heavier flows (remove, reorder, captions).

## Non-Goals

- No per-event configuration UI for landing distance / polar clamp (deferred — see *Open future work*).
- No batch / multi-file upload from the side panel; one photo at a time. Heavier flows stay on `/admin/tents/<id>/edit`.
- No category-count badge on chips.
- No realtime subscription for tent photos. The post-upload refresh is a manual reload-key bump.
- No change to `OrbitControls` configuration (limits, damping factor) outside the temporary disable during flyby.

## Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Auth scope for inline upload | Global admins **OR** per-event owners/editors. Mirrors Storage RLS exactly (`is_admin() OR has_event_role(eventId)`). |
| 2 | Filter behavior with a tent already selected | Keep the selected tent's marker visible even if the active filter would otherwise exclude it. Preserves user orientation. |
| 3 | Flyby landing pose | Preserve current azimuth, clamp polar to **[40°, 75°]**, distance **10 m** from tent. Module-level constants; per-event override deferred. |
| 4 | Return-to-overview trigger | Dedicated "Back to overview" button (not coupled to side-panel close). Flyby in both directions for symmetry. |
| 5 | Inline upload UI scope | Single-photo "+ Add photos" only. Single overall busy state (no per-file progress). Keep "Manage photos →" link to admin edit page. |
| 6 | Packaging | Three small PRs in sequence (PR-A → PR-B → PR-C). Matches existing repo cadence (#19, #20, #21, #23). |

## PR-A — Filter "Hide instead of dim"

### Files changed (~3)

- `src/pages/public/EventViewPage.tsx` — change `markers` `useMemo`.
- `tests/unit/pages/EventViewPage.test.tsx` (new or extended) — assertions on filter behavior.
- `src/lib/i18n.ts` — no new strings (reuses existing `category.*` keys).

### Logic change

`EventViewPage.markers` currently emits one `MarkerData` per tent with `dimmed: !matchesFilter`. New behavior:

```ts
const filterActive = selectedCategoryIds.size > 0;
return tents
  .filter((tnt): tnt is /* …same guard… */ => isXyz(tnt.position))
  .filter((tnt) => {
    if (!filterActive) return true;
    if (tnt.id === selectedTent?.id) return true; // Q2-A: keep selected tent visible
    return tnt.categories.some((c) => selectedCategoryIds.has(c.id));
  })
  .map((tnt) => ({ id: tnt.id, position: tnt.position, label: /* … */ }));
```

The `dimmed` field is no longer set by the filter path. `MarkerLayer` already removes markers absent from the next `setMarkers(...)` call (existing `seen` set). No `MarkerLayer` change needed.

### Tests

- Filter active + non-matching + not-selected → marker excluded from output.
- Filter active + non-matching + IS selected → marker still in output.
- Filter inactive → all markers present.
- (Existing dimming-on-selection logic — `m.dimmed === true || (selectedTentId != null && m.id !== selectedTentId)` in `SplatViewer` — unchanged.)

## PR-B — Camera Flyby + Return-to-Overview

### Files changed (~6)

- `src/lib/three/cameraFlyby.ts` (new) — `flyTo()` and `computeLandingPose()`.
- `src/components/BackToOverviewButton.tsx` (new) — floating button.
- `src/components/SplatViewer.tsx` — expose a flyby trigger via the existing `SplatSceneHandle` (or a new ref-forwarded API; see below).
- `src/pages/public/EventViewPage.tsx` — wire flyby into marker click + search-bar select; manage `cameraAwayFromDefault` state.
- `tests/unit/lib/three/cameraFlyby.test.ts` (new) — pure-function tests for `computeLandingPose`; fake-timer test for `flyTo`.
- `tests/unit/components/BackToOverviewButton.test.tsx` (new).
- `src/lib/i18n.ts` — `viewer.back_to_overview` (DE + EN).

### `cameraFlyby.ts` API

```ts
export interface FlyToOptions {
  durationMs?: number; // default 1000
  easing?: (t: number) => number; // default cubic ease-in-out
}

export interface FlyToHandle {
  promise: Promise<void>; // resolves on completion, rejects on cancel
  cancel: () => void;
}

export function flyTo(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControlsLike,
  endPose: CameraDefault,
  opts?: FlyToOptions,
): FlyToHandle;

export function computeLandingPose(
  currentCamera: THREE.PerspectiveCamera,
  currentTarget: THREE.Vector3,
  tentPosition: { x: number; y: number; z: number },
): CameraDefault;
```

Constants in the same file:

```ts
const LANDING_DISTANCE_M = 10;
const MIN_LANDING_POLAR = THREE.MathUtils.degToRad(40);
const MAX_LANDING_POLAR = THREE.MathUtils.degToRad(75);
// TODO(per-event-config): expose these via events.splat_camera_default_landing
// once the admin UI grows the controls. Tracked in deferred-items.
```

### `flyTo` implementation outline

Default duration 1000 ms — chosen for "intentional, not snappy" feel; long enough to read the camera motion, short enough that the user isn't blocked from the next click.

1. Snapshot current spherical state around `controls.target`: `r0`, `phi0`, `theta0`. Snapshot current `target0`.
2. Compute end spherical state around `endPose.target`: `r1`, `phi1`, `theta1`. Use `endPose.target` as `target1`.
3. Set `controls.enabled = false`, save and clear `controls.enableDamping`. Listen once to `controls.start` event — if fired, call `cancel()`.
4. Each animation frame (driven by the existing `renderer.setAnimationLoop` callback — we register a sibling per-frame hook on `SplatSceneHandle`, see "SceneHandle extension" below):
   - Compute `t = clamp((now - t0) / durationMs, 0, 1)`, easing applied.
   - Lerp scalars (`r`, `phi`, `theta`) and `target` Vector3.
   - Set `camera.position` from spherical; set `controls.target` from lerped target; `camera.lookAt(controls.target)`.
   - When `t === 1` → restore `controls.enabled` and damping; resolve promise; remove frame hook.
5. `cancel()` → restore controls, remove frame hook, reject promise with a sentinel (or just resolve — cancellation isn't an error, just an abort).

### SceneHandle extension

`SplatScene.ts` currently exposes `{ scene, camera, renderer, splatMesh, spark, controls, dispose }` and runs `renderer.setAnimationLoop` internally with a fixed callback (`controls.update(); renderer.render(...)`). To plug per-frame flyby ticks without restructuring the scene loop, add:

```ts
export interface SplatSceneHandle {
  // …existing…
  addFrameHook: (fn: (deltaMs: number) => void) => () => void; // returns disposer
}
```

Implementation: keep an internal `Set<FrameHook>`; the `setAnimationLoop` callback iterates it before `controls.update()`. `flyTo` registers a hook, returns `cancel = () => { /* restore + disposer() */ }`.

This keeps `cameraFlyby.ts` framework-free and testable without a renderer.

### `BackToOverviewButton` placement and visibility

- Bottom-right corner (mirrors `SetCameraDefaultButton`'s bottom-left placement).
- Visible iff `cameraAwayFromDefault === true` AND a `cameraDefault` exists.
- `EventViewPage` tracks `cameraAwayFromDefault` as `useState<boolean>(false)`. Set to `true` when:
  - A flyby is started with a non-default end pose (marker click, search-bar select).
  - The user manually moves the camera (subscribe to `controls.start` once on scene-ready; unsubscribe on dispose).
- Set to `false` when:
  - The initial `cameraDefault` is applied on scene init.
  - A flyby completes with the default as its end pose (i.e., the user clicked the button).
- On click: `flyTo(camera, controls, cameraDefault ?? FALLBACK_CAMERA)`.

### Marker-click + search-select flow

Both currently call `selectTentBySlug(slug)`. New flow:

```
onMarkerClick(id) | onSelectTent(tnt):
  selectTentBySlug(tnt.slug)
  if (tnt.slug === currentSlug) return  // toggle-deselect: don't fly
  const pose = computeLandingPose(camera, controls.target, tnt.position)
  flyTo(camera, controls, pose) // cancels any in-flight flyby first
```

### Cold-load on a deep-link URL (`/event/x/tent/y`)

- Scene init applies `cameraDefault` (snap), as today.
- Once `sceneReady` AND `tents` is loaded AND `selectedTent` exists, `EventViewPage` triggers a one-shot flyby toward `selectedTent`.
- Guard: a `didInitialFlyby` ref prevents re-firing on later re-renders.

### Cancellation paths

- **User interaction during flyby.** OrbitControls fires `start` on pointerdown when `controls.enabled === true` — but we set it to false. So manual cancel-on-interaction needs a separate canvas pointerdown listener installed only while a flyby is active. Simpler alternative: don't allow user gesture cancellation. Pros: predictable. Cons: 1 s feels long if mis-triggered. Decision: **install a one-shot pointerdown listener on the canvas while flyby is active that calls `cancel()`.** Re-enables controls so the user takes over immediately at the current intermediate pose. The implementation lives in `flyTo` itself, taking the canvas as an option.
- **Component unmount.** `SplatViewer`'s existing dispose cancels the animation loop entirely. `flyTo`'s frame hook checks a `cancelled` flag on each tick — if the loop is gone, no more ticks fire. No leak.

### Tests

`computeLandingPose`:
- Preserves azimuth across all polar values.
- Polar at 30° clamps to 40° (lower bound); polar at 80° clamps to 75° (upper bound); polar at 50° passes through.
- Distance always 10.

`flyTo`:
- With fake timers, advance to `durationMs`; assert camera at end pose; assert `controls.enabled === true` after; assert promise resolved.
- Call `cancel()` mid-flight; assert `controls.enabled === true`; assert promise rejected with the cancel sentinel.

`BackToOverviewButton`:
- Renders when `cameraAwayFromDefault && cameraDefault`. Hidden otherwise.
- Click invokes the flyby callback prop.

## PR-C — Inline "+ Add Photos" for Authorized Users

### Files changed (~5)

- `src/hooks/useCanEditEvent.ts` (new).
- `src/components/AddPhotosControl.tsx` (new).
- `src/components/SidePanel.tsx` — accept new props, render control + manage link conditionally.
- `src/hooks/usePhotos.ts` — accept optional `reloadKey` arg.
- `src/pages/public/EventViewPage.tsx` — wire `useCanEditEvent`, pass to SidePanel, manage `photosReloadKey`.
- `tests/unit/hooks/useCanEditEvent.test.ts` (new).
- `tests/unit/components/AddPhotosControl.test.tsx` (new).
- `tests/unit/components/SidePanel.test.tsx` — extended for canEdit branches.
- `src/lib/i18n.ts` — new strings (DE + EN): `side_panel.add_photo` (button label, singular per single-file decision), `side_panel.manage_photos`, `side_panel.uploading`, `side_panel.upload_error`.

### `useCanEditEvent` hook

```ts
export interface UseCanEditEventResult {
  canEdit: boolean;
  loading: boolean;
  error: Error | null;
}

export function useCanEditEvent(eventId: string | undefined): UseCanEditEventResult;
```

Implementation order:

1. `const { session } = useAuth(); const { profile, loading: profileLoading } = useProfile(session?.user.id);`
2. If `!session` → `{ canEdit: false, loading: false, error: null }`.
3. If `profileLoading` → `{ canEdit: false, loading: true, error: null }`.
4. If `profile?.role === 'admin'` → `{ canEdit: true, loading: false, error: null }` (no further fetch).
5. Else if `eventId && session.user.id`:
   - `useEffect` queries `event_users` once: `.select('role_in_event').eq('event_id', eventId).eq('user_id', session.user.id).maybeSingle()`.
   - State-tracking pattern (`fetchedFor: { eventId, userId }`) — same as `useProfile` to avoid stale-loading races.
   - Row exists → `canEdit: true`; row missing → `canEdit: false`; query error → `error` populated, `canEdit: false`.

Mirrors the SQL `is_admin() OR has_event_role(eventId)` exactly.

### `AddPhotosControl` component

Props: `{ eventId: string; tentId: string; onUploaded: () => void }`.

UI: a single button (label `t('side_panel.add_photo')` → "Foto hinzufügen" / "Add photo") + hidden `<input type="file" accept="image/*">` (no `multiple`). On change:

1. Read `e.target.files[0]`. If absent, return.
2. Set `busy = true`.
3. Compute `path = ${eventId}/${tentId}/${crypto.randomUUID()}.${ext}`.
4. `supabase.storage.from('tent-photos').upload(path, file)` → on error: clear busy, fire toast, return.
5. Count existing rows: `select('id', { count: 'exact', head: true }).eq('tent_id', tentId)` → use as `display_order`. (`head: true` keeps the request a count-only round-trip rather than fetching all rows like `PhotoUploadZone` does.)
6. `supabase.from('tent_photos').insert({ tent_id: tentId, storage_path: path, display_order: count })`.
7. Reset input, clear busy, call `onUploaded()`.

Errors surface through the existing `ToastProvider` (toast.error pattern from PR #21). No new error UI.

### `SidePanel` integration

New props: `eventId: string`, `canEdit: boolean`, `onPhotosChanged: () => void`.

```tsx
{canEdit && tent && (
  <div className="mt-2 flex flex-col gap-2 border-t border-white/10 pt-2">
    <AddPhotosControl
      eventId={eventId}
      tentId={tent.id}
      onUploaded={onPhotosChanged}
    />
    <Link
      to={`/admin/tents/${tent.id}/edit`}
      className="text-xs text-white/60 hover:text-white"
    >
      ✎ {t('side_panel.manage_photos')}
    </Link>
  </div>
)}
```

Placed below the existing photo strip (or above the description) so the relationship to photos is obvious.

### `usePhotos` change

```ts
export function usePhotos(tentId: string | undefined, reloadKey: number = 0): string[];
```

`reloadKey` added to the effect's dep list. One-line change. Existing call sites (the only one is in `EventViewPage`) pass the new key.

### `EventViewPage` wiring

```tsx
const { canEdit } = useCanEditEvent(event?.id);
const [photosReloadKey, setPhotosReloadKey] = useState(0);
const photoUrls = usePhotos(selectedTent?.id, photosReloadKey);
// …
<SidePanel
  tent={selectedTent}
  categories={selectedCategories}
  photoUrls={photoUrls}
  onClose={() => selectTentBySlug(null)}
  eventId={event.id}
  canEdit={canEdit}
  onPhotosChanged={() => setPhotosReloadKey((n) => n + 1)}
/>
```

### Security

- The hook is a UX gate. The actual security boundary is the existing storage RLS (`tent_photos_editor_insert` policy uses `has_event_role((storage.foldername(name))[1]::uuid) OR is_admin()`).
- Test the negative path: stub `supabase.storage.upload` to return an `ApiError` with `status: 403` (RLS rejection); assert the toast appears with the error message and `onUploaded` is **not** called.
- Adding the inline upload does not expand the attack surface — the same RLS would apply if a user crafted a request manually. The control just makes the legitimate flow one-click.

### Tests

`useCanEditEvent`:
- No session → canEdit=false, no fetch.
- Profile loading → loading=true, canEdit=false.
- Admin profile → canEdit=true, no `event_users` fetch made.
- Editor profile + event_users row exists → canEdit=true.
- Editor profile + no event_users row → canEdit=false.
- Editor profile + event_users query errors → error populated, canEdit=false.

`AddPhotosControl`:
- File select → upload + insert + onUploaded called.
- Upload fails → toast.error called, onUploaded NOT called, busy cleared.
- Insert fails after upload succeeds → toast.error called; (we accept the orphan storage object for now — same behavior as existing `PhotoUploadZone`. Logged in deferred-items.)

`SidePanel`:
- `canEdit=true` + tent → control + manage link both render.
- `canEdit=false` + tent → neither renders.
- `canEdit=true` + no tent → side panel returns null (existing behavior unchanged).

## Open Future Work (deferred — track in `docs/launch-readiness.md`)

- **Per-event landing config:** expose `LANDING_DISTANCE_M`, `MIN_LANDING_POLAR`, `MAX_LANDING_POLAR` as a per-event JSON column, configurable from the admin event-settings page. Use case: indoor venue, large landscape, first-floor view.
- **Orphan storage objects on insert failure** (PR-C step 6 fails after step 4 succeeded): add a finalizer that deletes the uploaded blob if the DB insert fails. Currently inherits the same gap from `PhotoUploadZone`.
- **Realtime photo updates:** subscribe to `tent_photos` changes so other admins editing concurrently see the new photo immediately. Currently relies on the local reload-key bump.
- **Category-count badges:** show "(7)" next to chips so users see how many tents would survive the filter before clicking.

## Risks

- **Three.js animation interrupted by component unmount.** Mitigated by `cancelled` flag check at the top of each frame tick. Existing `SplatViewer` dispose runs first, killing the animation loop.
- **OrbitControls damping fighting the flyby.** Mitigated by saving and clearing `controls.enableDamping` at flyby start, restoring on completion or cancel. (Pattern from three.js's official `webgl_watch.html` example.)
- **`useCanEditEvent` caching stale across event swaps.** The `fetchedFor` state-tracker is keyed on `(eventId, userId)`, so navigating between events re-fetches.
- **Side-panel z-index vs. flyby button.** `SetCameraDefaultButton` already lives at `z-30` bottom-left. New `BackToOverviewButton` at `z-30` bottom-right. SidePanel mobile mode covers the bottom 60vh — both buttons may be obscured. Acceptable: when the panel is open, the user is engaged with the tent details; viewer-level controls being out of reach is fine. (Confirm during smoke test.)

## Test Strategy

All new code is covered by Vitest unit tests; no Playwright additions required for these PRs (the existing `tests/e2e/` smoke covers the affected pages and would surface any obvious regression). Each PR's tests live under `tests/unit/...` mirroring the source path.

Smoke checklist additions for `docs/launch-readiness.md`:

- Apply a category filter; non-matching markers disappear; selected tent's marker stays.
- Click a sign on the map → camera animates ≈1 s to ~10 m from the tent at a slightly tilted angle.
- "Back to overview" button appears bottom-right; clicking it animates back to the saved default.
- Sign in as admin → open a tent → "Add photo" button + "Manage photos" link both appear.
- Sign in as a per-event editor (test fixture) → same controls appear.
- Sign in as a non-admin without per-event grant → controls hidden.
- Visitor (no session) → controls hidden.

## Sequencing

1. **PR-A (filter hide).** Independent. Lands first because it's the simplest and de-risks the others.
2. **PR-B (flyby).** Builds on the existing `cameraDefault` infra. Lands after A.
3. **PR-C (inline upload).** Independent of A and B but lands last because it touches the auth surface and benefits from focused review.
