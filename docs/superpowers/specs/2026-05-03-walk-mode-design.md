# Walk Mode — Design

**Date:** 2026-05-03
**Status:** Approved (awaiting writing-plans hand-off)
**Scope:** Desktop-first experimental ship of a "street view" first-person navigation mode for the public viewer. Mobile path kept open as a deliberate follow-up.

## Goal

Let visitors enter a first-person mode that places the camera at human eye height (~1.7 m) above the splat surface and lets them walk around by tapping ground points. Sign-post tent markers double as click destinations: tapping a sign auto-walks to it AND opens the SidePanel on arrival.

## Non-Goals

- No virtual joystick, no touch joystick, no on-screen movement controls. Mobile gets the desktop control scheme as-is (tap-to-walk + drag-to-look both work natively on touch); a richer mobile experience is a deliberate follow-up.
- No collision detection. Visitors can walk *through* tents, trees, and walls — accepted as v1 cost (matches Google Earth's "ghost camera" first-person feel).
- No keyboard movement (WASD). Click-to-walk is the entire locomotion surface.
- No "free fly" mode. Camera y is bound to ground + eye-height, never decoupled.
- No per-event configuration UI for eye height / walk speed (deferred — same pattern as the existing flyby's polar clamp).
- No "Walk here" button per tent in v1. Discoverable single entry point only. Easy to add later if needed (Q4-C in the brainstorm).

## Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Scope and timing | Desktop-first experimental ship (post-launch is fine; mobile parity deferred). |
| 2 | Control scheme | **Click-to-walk + drag-to-look.** Tap an empty ground point → camera auto-walks there. Drag → camera rotates in place. No keyboard. |
| 3 | Sign behavior in walk mode | **Tap sign = auto-walk + open SidePanel on arrival.** Single click pattern; outcome depends on what was clicked (ground vs sign). |
| 4 | Entry / exit affordance | **Persistent "🚶 Walk" toggle button top-right.** Exit reuses the existing "↩ Back to overview" button — clicking it flies the camera back up to the saved default. |

## Architecture

### New files

- `src/lib/three/walkMode.ts` — controller class. Pure helper, no React. Owns walk-mode camera state, click handling, ground-following math.
- `src/components/WalkModeButton.tsx` — floating "🚶 Walk" toggle in the top-right of the viewer (next to the menu icon).
- `tests/unit/lib/three/walkMode.test.ts` — unit tests for the math (eye-height clamp, surface-normal filter, walk-duration calc).
- `tests/unit/components/WalkModeButton.test.tsx` — render + click tests.

### Modified files

- `src/lib/three/cameraFlyby.ts` — extend `flyTo` with an `eyeLevel?: boolean` option that suppresses polar clamping and aim-high shift and uses the ground-resampling tick. Reuses the existing animation loop, easing, and cancel infrastructure.
- `src/components/SplatViewer.tsx` — accept a `walkMode: boolean` prop; switch the canvas cursor when active.
- `src/pages/public/EventViewPage.tsx` — manage `walkMode` boolean state; render `WalkModeButton`; route ground-clicks to the walkMode controller; coordinate exit with the existing `flyHome` function.
- `src/locales/{de,en}/common.json` — `viewer.walk_enter`, `viewer.walk_exit`, `viewer.walk_first_time_toast` strings.

### Component diagram

```
EventViewPage
├── walkMode: boolean (useState)
├── walkModeRef: useRef<WalkModeController | null>(null)
├── WalkModeButton — toggles walkMode
├── SplatViewer (passes walkMode through; switches cursor)
└── on enter → flyTo(camera, controls, addFrameHook, dropPose, { eyeLevel: true })
                 then walkModeRef.current = new WalkModeController({ ..., onTentReached })
    on exit  → walkModeRef.current?.dispose(); walkModeRef.current = null;
                 flyHome() (flies back to cameraDefault)
    on canvas click while walkMode → walkModeRef.current?.handleClick(ndc)
    on canvas drag while walkMode  → walkModeRef.current?.handleDrag(deltas)
    onTentReached(tentId) → selectTentBySlug(tents.find(t => t.id === tentId)?.slug)
```

## Interaction Flow

1. **Enter.** Visitor clicks "🚶 Walk" in the top-right.
   - `EventViewPage` sets `walkMode = true`, instantiates `WalkModeController`.
   - `WalkModeController` performs an entry flyTo: from current camera state to a "drop pose" at the same xz, y = (current ground hit beneath the camera) + EYE_HEIGHT_M. Look direction preserved (just lowered).
   - On arrival: `controls.enabled = false`, walk-mode pointer/drag listeners installed on the canvas.
   - First-time toast: "Drag to look around. Tap to walk." Shown once per browser via `localStorage` (key: `kunstmeile_walk_toast_seen`). Not per-event, not per-user — the goal is to teach the gesture once.

2. **Tap a ground point.** `WalkModeController` raycasts from the camera through the cursor NDC into the splat mesh.
   - **Filter:** accept the hit only if its surface normal is roughly upward (dot with world-up > `MIN_GROUND_NORMAL_Y` ≈ 0.6 ≈ surfaces tilted ≤ 53° from horizontal). Avoids "walk onto a tent roof" hits.
   - **Hit accepted:** start an auto-walk from current camera pose to the hit point. Duration = `clamp(distance / WALK_SPEED_M_PER_S, 0, MAX_WALK_DURATION_MS)` with `WALK_SPEED_M_PER_S = 3` and `MAX_WALK_DURATION_MS = 4000`.
   - **Hit rejected (sky / canopy / no hit):** no movement; small visual feedback optional but not in v1.

3. **Auto-walk path.** A frame hook (registered via `SplatSceneHandle.addFrameHook`):
   - Lerps `xz` from start to target with cubic ease-in-out.
   - Resamples ground y every `GROUND_RESAMPLE_FRAMES = 5` frames by raycasting downward from `(x, currentY + 5, z)`. Camera y = sample.y + EYE_HEIGHT_M, lerped between samples for smoothness.
   - If a sample misses (no hit, sparse splat), keep previous y.
   - Look direction unchanged during the walk (camera doesn't auto-rotate to face destination — preserves user agency).

4. **Tap a sign.** Same auto-walk flow as ground tap, with two differences:
   - Land 2 m short of the sign (compute target as `signPos - 2 * normalize(signPos - cameraPos)` projected to ground). So the sign isn't directly under the camera at arrival.
   - On arrival, fire `onTentSelected(tentId)` so `EventViewPage` opens the SidePanel.

5. **Drag.** Pointer-down + move > tap-vs-drag threshold (existing 6 px / 500 ms rule) = rotate.
   - Cancel any in-flight auto-walk on drag-start.
   - Δx → rotate camera azimuth (yaw). Δy → rotate camera pitch.
   - Pitch clamped to `[-PITCH_LIMIT, +PITCH_LIMIT]` with `PITCH_LIMIT = 60°` from horizontal.
   - Drag-end commits the new look direction.
   - Implementation note: walk mode hijacks pointer events on the canvas via the same listeners SplatViewer already uses for tap-vs-drag detection; the existing 6 px / 500 ms threshold is the discriminator. No new pointer infrastructure.

6. **Mid-walk cancellation.** Tap during an active auto-walk → cancel the in-flight walk and start a new one to the new tap. Drag during walk → cancel the walk and start rotating.

7. **Exit.** Visitor clicks "↩ Back to overview".
   - `WalkModeController.dispose()` — removes listeners, sets `walkMode = false` upstream.
   - `flyHome()` (existing) — flies camera back to the saved default. After arrival, OrbitControls re-enabled.

## Technical Choices (constants)

All constants live at the top of `src/lib/three/walkMode.ts`. Per-event override deferred to future work.

| Constant | Value | Rationale |
|---|---|---|
| `EYE_HEIGHT_M` | 1.7 | Standing adult eye height. |
| `WALK_SPEED_M_PER_S` | 3 | Jogger pace. Strict-walk pace would feel slow over 500 × 300 m. |
| `MAX_WALK_DURATION_MS` | 4000 | Cap on auto-walk duration. Long-distance taps don't make the user wait forever. |
| `GROUND_RESAMPLE_FRAMES` | 5 | ~12 raycasts/s at 60 fps. Cheap; matches the splat raycast cost from PlaceMode. |
| `MIN_GROUND_NORMAL_Y` | 0.6 | Surface-normal filter (≤ ~53° from horizontal). Excludes near-vertical splat hits (tent walls, trees). |
| `PITCH_LIMIT_DEG` | 60 | Drag pitch clamped to ±60° from horizontal. Prevents over-the-top flip. |
| `SIGN_APPROACH_OFFSET_M` | 2 | When tapping a sign, land 2 m short so the sign isn't right under the camera. |

`flyTo` gets one new option:

```ts
export interface FlyToOptions {
  durationMs?: number;
  easing?: (t: number) => number;
  /**
   * When true, suppress polar clamping and the aimHigh shift; instead, on each
   * tick, resample ground y and set camera position relative to that. Used by
   * walk-mode entry and walk-mode auto-walk.
   */
  eyeLevel?: boolean;
}
```

## State Machine

```
[overview] ──Walk button──▶ [entering: flyTo eyeLevel=true]
[entering] ──flyTo resolves─▶ [walking-idle]
[walking-idle] ──tap────────▶ [walking-auto: flyTo eyeLevel=true]
[walking-auto] ──flyTo resolves▶ [walking-idle]
[walking-auto] ──tap────────▶ [walking-auto: cancel + new flyTo]
[walking-auto] ──drag───────▶ [walking-rotate: cancel walk + rotate]
[walking-idle] ──drag───────▶ [walking-rotate]
[walking-rotate] ──pointer-up▶ [walking-idle]
[any walk state] ──Back to overview──▶ [exiting: existing flyHome]
[exiting] ──flyHome done────▶ [overview]
```

Note on transitions: `flyTo` rejects with `FlyCancelledError` when cancelled (e.g., by a new tap). The walk-mode controller catches that as the trigger to start a new auto-walk; it is NOT an error. flyHome on exit follows the same convention.

## Tests

### `tests/unit/lib/three/walkMode.test.ts`

Pure-function tests for the math (no DOM, no renderer):

- **`computeEyePose(groundHit, currentLook)`** — returns position = ground + (0, EYE_HEIGHT, 0); look direction preserved.
- **`computeWalkDuration(distanceM)`** — distance 3 → ~1000 ms; distance 30 → 4000 ms (capped); distance 0 → 0.
- **`isGroundLikeNormal(normal)`** — accepts (0,1,0); rejects (1,0,0); accepts (0.6, 0.8, 0); rejects (0, 0.5, 0.87) (60° from up).
- **`computeSignApproachTarget(cameraXZ, signXZ)`** — returns a point 2 m from sign on the cameraXZ→signXZ line; idempotent if already > 2 m away.
- **`clampPitch(pitchRad)`** — values inside ±60° pass through; values outside clamp.

### `tests/unit/components/WalkModeButton.test.tsx`

- Renders with localized label.
- Click invokes the `onToggle` callback.
- Active state changes the button's appearance (e.g., filled background when walk mode is on).

### `cameraFlyby.test.ts` extension

- `flyTo` with `eyeLevel: true` calls `addFrameHook` (existing path) but doesn't require a polar clamp / aimHigh shift. Test the option is plumbed; the actual ground-resample tick is a walkMode concern, not a flyTo concern — see "Boundary" below.

### Manual smoke (in PR descriptions)

- Click "🚶 Walk" → camera drops to ground level smoothly.
- Tap a ground point → camera walks there at jog pace; y follows the ground gently.
- Tap a sign → camera walks toward sign; lands ~2 m short; SidePanel opens.
- Drag during walk → walk cancels; pitch clamped at ±60°.
- Click "↩ Back to overview" → camera flies up to saved default; walk mode exits.
- Refresh the page and re-enter walk mode → first-time toast shown again only on first session per browser.

## Boundary Between `walkMode.ts` and `cameraFlyby.ts`

To keep `cameraFlyby.ts` framework-free and the `flyTo` API simple, the **ground-resampling tick lives inside `walkMode.ts`, not inside `flyTo`**. Concretely:

- `flyTo({ eyeLevel: true })` does the same lerp(start → end) as the regular flyTo, except it **doesn't apply** the polar clamp or aimHigh shift to the input pose. It treats the input pose as "where to land" verbatim.
- During the lerp, `walkMode.ts` registers its own frame hook on `SplatSceneHandle.addFrameHook` that runs every `GROUND_RESAMPLE_FRAMES` and writes `camera.position.y = surfaceY + EYE_HEIGHT_M`. This hook lives only while walk mode is active and is removed on exit.

Consequence: during an auto-walk, two frame hooks are registered concurrently (the flyTo lerp + the walkMode ground-follower). They don't conflict — flyTo writes camera.position; ground-follower overrides camera.position.y. The ground-follower wins because it runs after.

## Open Future Work (deferred — track in `docs/launch-readiness.md`)

- **Per-event walk-mode tuning:** expose `EYE_HEIGHT_M`, `WALK_SPEED_M_PER_S`, `MIN_GROUND_NORMAL_Y` as a per-event JSON column. Use case: indoor venue (lower eye), large landscape (faster speed).
- **Mobile virtual-joystick mode:** for users who want to walk continuously without re-tapping. Out of v1 scope; revisit only if user testing shows demand.
- **Per-tent "Walk here" button** in the SidePanel (Q4-C in the brainstorm). Easy to add once the persistent button works.
- **Collision detection.** Splat-only scenes have no real geometry; would require building a navmesh or a coarse height-field offline. Not a v1 path.
- **Run / sprint toggle.** Currently a single speed; could add a hold-to-run modifier later if desktop walk traversal feels slow.

## Risks

- **Ground-like normal filter (`MIN_GROUND_NORMAL_Y`) tuning is empirical.** Too strict → walking is jumpy on slightly tilted ground. Too loose → user "walks up" tent roofs. The 0.6 threshold (≤53° tilt) is a starting point; expect to tune on the real Kunstmeile splat after the drone capture day. Documented in commit message + this spec.
- **Through-the-wall walking.** No collision. User can walk through tents/trees. Accepted; matches the Google Earth first-person feel. If user testing surfaces this as confusing, the cheapest mitigation is to fade the splat opacity slightly when "inside" a tent (camera-y is below the marker-y of a nearby tent) — out of v1 scope.
- **Drag-to-look discoverability.** Mitigated by the first-time toast; if visitors miss the toast and don't try dragging, they're stuck looking the same direction. Watch in user testing.
- **Spark v2 raycast performance** for the ground resample. PlaceMode raycast is acceptable for hover; here we run it ~12×/s during auto-walks. Should be fine on desktop; flag this as a thing to watch on the smoke pass.

## Test Strategy

All new code covered by Vitest unit tests; manual smoke matrix in each PR's body. No new Playwright tests for v1 — walk mode is experimental and we want the validation cycle to be on real preview deploys, not on synthetic e2e flows.

## Sequencing

Two small PRs in sequence:

1. **PR-W1 — walkMode controller + button + flyTo eyeLevel option + ground-following raycast.** No tent integration yet — clicking a sign in walk mode just auto-walks to the ground beneath it. Pure-function tests for the math + minimal button render tests.
2. **PR-W2 — sign click in walk mode auto-opens SidePanel on arrival** (the Q3-C piece) **+ first-time toast** + smoke pass on real preview deploys.

PR-W1 ships a usable but feature-incomplete walk mode. PR-W2 closes the loop with the sign-arrival panel and the toast. Splitting them keeps each PR reviewable in <30 minutes.
