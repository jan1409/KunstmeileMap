# Viewer Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three small public-viewer enhancements as three separate PRs against `main`: (PR-A) category filter hides non-matching markers; (PR-B) camera flyby on tent select with Back-to-Overview button; (PR-C) inline single-photo upload in the side panel for admins / per-event editors.

**Architecture:** Follow the existing repo patterns — pure helpers under `src/lib/three/` with Vitest unit tests; React components under `src/components/` with React Testing Library tests; hooks under `src/hooks/` with the state-tracking-fetch pattern from `useProfile`. No new dependencies. Each PR ships independently and is reviewable in <30 minutes.

**Tech Stack:** React 19, react-router-dom 7, three.js 0.180 (with Spark v2 splat renderer + OrbitControls), TypeScript, Vitest + @testing-library/react, Supabase JS v2, react-i18next 17, Tailwind 3.

**Source spec:** `docs/superpowers/specs/2026-05-03-viewer-enhancements-design.md`

---

# PR-A — Category Filter "Hide Instead of Dim"

## Task A1: Extract filter logic to a pure helper, wire into EventViewPage

**Files:**
- Create: `src/lib/markers.ts`
- Create: `tests/unit/lib/markers.test.ts`
- Modify: `src/pages/public/EventViewPage.tsx` (replaces inline `markers` `useMemo`)

### Steps

- [ ] **Step 1: Create branch**

```bash
git switch -c feat/viewer-filter-hide
```

- [ ] **Step 2: Write the failing test**

Create `tests/unit/lib/markers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { selectVisibleMarkers } from '../../../src/lib/markers';
import type { TentWithCategories } from '../../../src/lib/supabase';

function tent(
  id: string,
  categoryIds: string[],
  position: { x: number; y: number; z: number } | null = { x: 0, y: 0, z: 0 },
  display_number: number | null = null,
): TentWithCategories {
  return {
    id,
    slug: `tent-${id}`,
    event_id: 'evt-1',
    name: `Tent ${id}`,
    description_de: '',
    description_en: '',
    address: null,
    website_url: null,
    instagram_url: null,
    facebook_url: null,
    position: position as unknown as TentWithCategories['position'],
    display_number,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    categories: categoryIds.map((cid) => ({
      id: cid,
      event_id: 'evt-1',
      name_de: cid,
      name_en: cid,
      icon: null,
      sort_order: 0,
      created_at: '2026-01-01T00:00:00Z',
    })),
  } as TentWithCategories;
}

describe('selectVisibleMarkers', () => {
  it('returns one marker per tent with a valid {x,y,z} position when no filter is active', () => {
    const tents = [tent('a', ['c1']), tent('b', ['c2'])];
    const out = selectVisibleMarkers(tents, new Set(), null);
    expect(out.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('skips tents whose position is not a valid {x,y,z}', () => {
    const tents = [tent('a', ['c1']), tent('b', ['c2'], null)];
    const out = selectVisibleMarkers(tents, new Set(), null);
    expect(out.map((m) => m.id)).toEqual(['a']);
  });

  it('keeps only matching tents when a filter is active (OR-semantics across selected categories)', () => {
    const tents = [tent('a', ['c1']), tent('b', ['c2']), tent('c', ['c1', 'c3'])];
    const out = selectVisibleMarkers(tents, new Set(['c1']), null);
    expect(out.map((m) => m.id).sort()).toEqual(['a', 'c']);
  });

  it('keeps the currently selected tent visible even when the active filter would exclude it', () => {
    const tents = [tent('a', ['c1']), tent('b', ['c2'])];
    const out = selectVisibleMarkers(tents, new Set(['c1']), 'b');
    expect(out.map((m) => m.id).sort()).toEqual(['a', 'b']);
  });

  it('uses display_number as the marker label when present, otherwise null', () => {
    const tents = [tent('a', ['c1'], { x: 0, y: 0, z: 0 }, 7), tent('b', ['c1'])];
    const out = selectVisibleMarkers(tents, new Set(), null);
    expect(out.find((m) => m.id === 'a')?.label).toBe('7');
    expect(out.find((m) => m.id === 'b')?.label).toBeNull();
  });
});
```

- [ ] **Step 3: Run test, verify fail**

```bash
npm run test:run -- tests/unit/lib/markers.test.ts
```

Expected: FAIL with "Cannot find module '../../../src/lib/markers'".

- [ ] **Step 4: Implement `selectVisibleMarkers`**

Create `src/lib/markers.ts`:

```ts
import type { MarkerData } from './three/MarkerLayer';
import type { TentWithCategories } from './supabase';

function isXyz(v: unknown): v is { x: number; y: number; z: number } {
  return (
    typeof v === 'object' && v !== null &&
    typeof (v as { x?: unknown }).x === 'number' &&
    typeof (v as { y?: unknown }).y === 'number' &&
    typeof (v as { z?: unknown }).z === 'number'
  );
}

/**
 * Pick which tents render as map markers and shape them for `MarkerLayer`.
 *
 * - Tents with a non-{x,y,z} `position` are skipped (defensive — admin Place
 *   Mode in A3-T05 only emits valid).
 * - When `selectedCategoryIds` is non-empty, only tents matching at least one
 *   of those categories survive (OR-semantics) — UNLESS a tent is currently
 *   selected (`selectedTentId`), in which case it stays visible regardless so
 *   the open side panel keeps an anchor.
 */
export function selectVisibleMarkers(
  tents: TentWithCategories[],
  selectedCategoryIds: Set<string>,
  selectedTentId: string | null,
): MarkerData[] {
  const filterActive = selectedCategoryIds.size > 0;
  return tents
    .filter((t) => isXyz(t.position))
    .filter((t) => {
      if (!filterActive) return true;
      if (t.id === selectedTentId) return true;
      return t.categories.some((c) => selectedCategoryIds.has(c.id));
    })
    .map((t) => ({
      id: t.id,
      position: t.position as { x: number; y: number; z: number },
      label: t.display_number != null ? String(t.display_number) : null,
    }));
}
```

- [ ] **Step 5: Run test, verify pass**

```bash
npm run test:run -- tests/unit/lib/markers.test.ts
```

Expected: PASS — 5 tests.

- [ ] **Step 6: Wire `selectVisibleMarkers` into `EventViewPage`**

Modify `src/pages/public/EventViewPage.tsx`:

Remove the existing `isXyz` helper near the top of the file (the one between the imports and `EventViewPage`):

```ts
function isXyz(v: unknown): v is { x: number; y: number; z: number } {
  return (
    typeof v === 'object' && v !== null &&
    typeof (v as { x?: unknown }).x === 'number' &&
    typeof (v as { y?: unknown }).y === 'number' &&
    typeof (v as { z?: unknown }).z === 'number'
  );
}
```

Replace the entire `markers` `useMemo` (the block currently building from `tents.filter(...).map(...)` with the OR-filter and `dimmed: !matchesFilter`) with:

```ts
const markers: MarkerData[] = useMemo(
  () => selectVisibleMarkers(tents, selectedCategoryIds, selectedTent?.id ?? null),
  [tents, selectedCategoryIds, selectedTent?.id],
);
```

Add the import at the top of the file:

```ts
import { selectVisibleMarkers } from '../../lib/markers';
```

Update the `splatOrigin` `useMemo` — it still uses the local `isXyz` we just deleted. Inline the type guard so it doesn't need the helper:

```ts
const splatOrigin = useMemo(() => {
  const o = event?.splat_origin;
  if (
    typeof o === 'object' && o !== null &&
    typeof (o as { x?: unknown }).x === 'number' &&
    typeof (o as { y?: unknown }).y === 'number' &&
    typeof (o as { z?: unknown }).z === 'number'
  ) {
    return o as { x: number; y: number; z: number };
  }
  return undefined;
}, [event?.splat_origin]);
```

- [ ] **Step 7: Run full test + type-check + lint**

```bash
npm run test:run
npm run type-check
npm run lint
```

Expected: all pass. (Existing tests cover the page; the inline isXyz removal must not break the splatOrigin path.)

- [ ] **Step 8: Commit**

```bash
git add src/lib/markers.ts tests/unit/lib/markers.test.ts src/pages/public/EventViewPage.tsx
git commit -m "$(cat <<'EOF'
feat(viewer): hide non-matching tents under category filter

Replace dim-on-non-match with a pure selectVisibleMarkers helper that
drops tents from the markers array entirely when a category filter is
active. Currently selected tent (if any) stays visible regardless so
the open SidePanel keeps its anchor.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 9: Push and open PR**

```bash
git push -u origin feat/viewer-filter-hide
gh pr create --title "feat(viewer): hide non-matching tents under category filter" --body "$(cat <<'EOF'
## Summary
- Extract marker filter logic into a pure `selectVisibleMarkers` helper.
- Non-matching tents are now removed from the map entirely (previously dimmed to 40 % opacity).
- Currently selected tent stays visible regardless of filter so the open SidePanel keeps its anchor.

## Test plan
- [x] Unit tests for selectVisibleMarkers (5 cases, all green).
- [ ] Manual: open the public viewer, click a category chip → non-matching markers disappear.
- [ ] Manual: open a tent's side panel, then apply a filter that excludes it → that tent's marker stays visible.
- [ ] Manual: clear filter → all markers return.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

# PR-B — Camera Flyby + Return-to-Overview

## Task B1: Extend `SplatSceneHandle` with `addFrameHook`

**Files:**
- Modify: `src/lib/three/SplatScene.ts`

### Steps

- [ ] **Step 1: Create branch (off main, after PR-A is merged)**

```bash
git switch main
git pull
git switch -c feat/viewer-flyby
```

- [ ] **Step 2: Add `addFrameHook` to the handle**

Modify `src/lib/three/SplatScene.ts`. Update the interface:

```ts
export interface SplatSceneHandle {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  splatMesh: SplatMesh;
  spark: SparkRenderer;
  controls: OrbitControls;
  /**
   * Register a per-frame callback. The callback receives the milliseconds
   * elapsed since the previous frame (0 on the first invocation). Returns a
   * disposer that unregisters the hook.
   */
  addFrameHook: (cb: (deltaMs: number) => void) => () => void;
  dispose: () => void;
}
```

Replace the animation-loop block (currently `renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });`) with:

```ts
  const frameHooks = new Set<(deltaMs: number) => void>();
  let lastFrameMs: number | null = null;

  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const deltaMs = lastFrameMs == null ? 0 : now - lastFrameMs;
    lastFrameMs = now;
    for (const hook of frameHooks) hook(deltaMs);
    controls.update(); // required when enableDamping = true
    renderer.render(scene, camera);
  });

  const addFrameHook = (cb: (deltaMs: number) => void): (() => void) => {
    frameHooks.add(cb);
    return () => {
      frameHooks.delete(cb);
    };
  };
```

Update the dispose block to clear hooks for safety:

```ts
  const dispose = () => {
    renderer.setAnimationLoop(null);
    frameHooks.clear();
    window.removeEventListener('resize', onResize);
    controls.dispose();
    spark.dispose();
    renderer.dispose();
    if ('dispose' in splatMesh && typeof (splatMesh as { dispose?: () => void }).dispose === 'function') {
      (splatMesh as { dispose: () => void }).dispose();
    }
  };
```

Update the return statement:

```ts
  return { scene, camera, renderer, splatMesh, spark, controls, addFrameHook, dispose };
```

- [ ] **Step 3: Run type-check**

```bash
npm run type-check
```

Expected: pass. (No tests exist for SplatScene.ts directly — it requires WebGL. Coverage for this change comes via the flyTo test in Task B3 which exercises the addFrameHook contract through a stub.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/three/SplatScene.ts
git commit -m "$(cat <<'EOF'
feat(3d): expose addFrameHook on SplatSceneHandle

Per-frame hook registry called before controls.update() each frame,
with deltaMs since the previous tick. Used by the new cameraFlyby
module to animate the camera without restructuring the scene loop.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

## Task B2: Pure helper `computeLandingPose`

**Files:**
- Create: `src/lib/three/cameraFlyby.ts` (will grow in B3)
- Create: `tests/unit/lib/three/cameraFlyby.test.ts`

### Steps

- [ ] **Step 1: Write the failing test for `computeLandingPose`**

Create `tests/unit/lib/three/cameraFlyby.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  computeLandingPose,
  LANDING_DISTANCE_M,
  MIN_LANDING_POLAR,
  MAX_LANDING_POLAR,
} from '../../../../src/lib/three/cameraFlyby';

function makeCamera(position: [number, number, number]): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera();
  cam.position.set(...position);
  return cam;
}

describe('computeLandingPose', () => {
  it('returns the tent position as the new target', () => {
    const cam = makeCamera([0, 5, 10]);
    const pose = computeLandingPose(cam, new THREE.Vector3(0, 0, 0), { x: 3, y: 0, z: 4 });
    expect(pose.target).toEqual({ x: 3, y: 0, z: 4 });
  });

  it('lands at exactly LANDING_DISTANCE_M from the tent', () => {
    const cam = makeCamera([0, 5, 10]);
    const pose = computeLandingPose(cam, new THREE.Vector3(0, 0, 0), { x: 3, y: 0, z: 4 });
    const dx = pose.position.x - pose.target.x;
    const dy = pose.position.y - pose.target.y;
    const dz = pose.position.z - pose.target.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    expect(distance).toBeCloseTo(LANDING_DISTANCE_M, 5);
  });

  it('preserves the current azimuth angle', () => {
    // Camera at (10, 0, 0) relative to (0,0,0): azimuth = π/2 (looking down -X
    // toward origin from +X). After flyby to a new tent, azimuth should match.
    const cam = makeCamera([10, 0.001, 0.001]);
    const currentTarget = new THREE.Vector3(0, 0, 0);
    const tent = { x: 100, y: 0, z: 100 };

    const pose = computeLandingPose(cam, currentTarget, tent);

    const before = new THREE.Spherical().setFromVector3(
      new THREE.Vector3().subVectors(cam.position, currentTarget),
    );
    const after = new THREE.Spherical().setFromVector3(
      new THREE.Vector3().subVectors(
        new THREE.Vector3(pose.position.x, pose.position.y, pose.position.z),
        new THREE.Vector3(pose.target.x, pose.target.y, pose.target.z),
      ),
    );
    expect(after.theta).toBeCloseTo(before.theta, 5);
  });

  it('clamps polar angle below MIN_LANDING_POLAR (camera near top-down)', () => {
    // Camera straight above target → polar ≈ 0; below MIN_LANDING_POLAR.
    const cam = makeCamera([0, 10, 0]);
    const pose = computeLandingPose(cam, new THREE.Vector3(0, 0, 0), { x: 0, y: 0, z: 0 });
    const after = new THREE.Spherical().setFromVector3(
      new THREE.Vector3(pose.position.x, pose.position.y, pose.position.z),
    );
    expect(after.phi).toBeCloseTo(MIN_LANDING_POLAR, 5);
  });

  it('clamps polar angle above MAX_LANDING_POLAR (camera near horizontal)', () => {
    // Camera level with target on +X axis → polar ≈ π/2.
    const cam = makeCamera([10, 0.001, 0]);
    const pose = computeLandingPose(cam, new THREE.Vector3(0, 0, 0), { x: 0, y: 0, z: 0 });
    const after = new THREE.Spherical().setFromVector3(
      new THREE.Vector3(pose.position.x, pose.position.y, pose.position.z),
    );
    expect(after.phi).toBeCloseTo(MAX_LANDING_POLAR, 5);
  });

  it('preserves polar angle when already inside [MIN_LANDING_POLAR, MAX_LANDING_POLAR]', () => {
    // Build a camera at exactly polar = 60° (between 40 and 75) on +X side.
    const polar = THREE.MathUtils.degToRad(60);
    const radius = 10;
    const sph = new THREE.Spherical(radius, polar, 0);
    const offset = new THREE.Vector3().setFromSpherical(sph);
    const cam = new THREE.PerspectiveCamera();
    cam.position.copy(offset);

    const pose = computeLandingPose(cam, new THREE.Vector3(0, 0, 0), { x: 0, y: 0, z: 0 });
    const after = new THREE.Spherical().setFromVector3(
      new THREE.Vector3(pose.position.x, pose.position.y, pose.position.z),
    );
    expect(after.phi).toBeCloseTo(polar, 5);
  });
});
```

- [ ] **Step 2: Run test, verify fail**

```bash
npm run test:run -- tests/unit/lib/three/cameraFlyby.test.ts
```

Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Implement `computeLandingPose`**

Create `src/lib/three/cameraFlyby.ts`:

```ts
import * as THREE from 'three';
import type { CameraDefault } from './cameraDefault';

// TODO(per-event-config): expose these via events.splat_camera_default_landing
// once the admin UI grows the controls. Tracked in deferred-items.
export const LANDING_DISTANCE_M = 10;
export const MIN_LANDING_POLAR = THREE.MathUtils.degToRad(40);
export const MAX_LANDING_POLAR = THREE.MathUtils.degToRad(75);

/**
 * Compute a "land here" pose for the camera given the current pose and a
 * tent position. Preserves the current azimuth, clamps polar to
 * [MIN_LANDING_POLAR, MAX_LANDING_POLAR], and sets distance to
 * LANDING_DISTANCE_M from the tent.
 */
export function computeLandingPose(
  currentCamera: THREE.PerspectiveCamera,
  currentTarget: THREE.Vector3,
  tentPosition: { x: number; y: number; z: number },
): CameraDefault {
  const offset = new THREE.Vector3().subVectors(currentCamera.position, currentTarget);
  const sph = new THREE.Spherical().setFromVector3(offset);

  const phi = THREE.MathUtils.clamp(sph.phi, MIN_LANDING_POLAR, MAX_LANDING_POLAR);
  const theta = sph.theta;
  const radius = LANDING_DISTANCE_M;

  const newOffset = new THREE.Vector3().setFromSpherical(new THREE.Spherical(radius, phi, theta));
  const targetVec = new THREE.Vector3(tentPosition.x, tentPosition.y, tentPosition.z);
  const positionVec = new THREE.Vector3().addVectors(targetVec, newOffset);

  return {
    position: { x: positionVec.x, y: positionVec.y, z: positionVec.z },
    target: { x: targetVec.x, y: targetVec.y, z: targetVec.z },
  };
}
```

- [ ] **Step 4: Run test, verify pass**

```bash
npm run test:run -- tests/unit/lib/three/cameraFlyby.test.ts
```

Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/three/cameraFlyby.ts tests/unit/lib/three/cameraFlyby.test.ts
git commit -m "$(cat <<'EOF'
feat(3d): computeLandingPose helper for camera flyby

Pure function that computes the landing pose for a tent flyby:
preserves current azimuth, clamps polar to [40°, 75°], distance
fixed at 10 m from the tent. Constants exported for future
per-event override.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

## Task B3: Implement `flyTo`

**Files:**
- Modify: `src/lib/three/cameraFlyby.ts` (add `flyTo` and supporting types)
- Modify: `tests/unit/lib/three/cameraFlyby.test.ts` (add `flyTo` cases)

### Steps

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/lib/three/cameraFlyby.test.ts`:

```ts
import { vi } from 'vitest';
import {
  flyTo,
  FlyCancelledError,
  type FrameHookRegistrar,
  type OrbitControlsLike,
} from '../../../../src/lib/three/cameraFlyby';

interface FakeRegistrar {
  register: FrameHookRegistrar;
  fire: (deltaMs: number) => void;
  hookCount: () => number;
}

function makeRegistrar(): FakeRegistrar {
  const hooks = new Set<(deltaMs: number) => void>();
  return {
    register: (cb) => {
      hooks.add(cb);
      return () => {
        hooks.delete(cb);
      };
    },
    fire: (deltaMs) => {
      for (const cb of hooks) cb(deltaMs);
    },
    hookCount: () => hooks.size,
  };
}

function makeControls(): OrbitControlsLike & {
  _listeners: Map<string, Set<() => void>>;
} {
  const listeners = new Map<string, Set<() => void>>();
  return {
    target: new THREE.Vector3(),
    enabled: true,
    enableDamping: true,
    update: vi.fn(),
    addEventListener: (type, cb) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(cb);
    },
    removeEventListener: (type, cb) => {
      listeners.get(type)?.delete(cb);
    },
    _listeners: listeners,
  };
}

describe('flyTo', () => {
  it('reaches the end pose after running the animation to completion and re-enables controls', async () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 10);
    const controls = makeControls();
    controls.target.set(0, 0, 0);
    const reg = makeRegistrar();
    const endPose = {
      position: { x: 5, y: 5, z: 5 },
      target: { x: 1, y: 1, z: 1 },
    };

    const handle = flyTo(camera, controls, reg.register, endPose, { durationMs: 1000 });

    // 5 ticks of 200 ms each → animation runs to completion.
    for (let i = 0; i < 5; i++) reg.fire(200);

    await handle.promise;

    expect(camera.position.x).toBeCloseTo(5, 4);
    expect(camera.position.y).toBeCloseTo(5, 4);
    expect(camera.position.z).toBeCloseTo(5, 4);
    expect(controls.target.x).toBeCloseTo(1, 4);
    expect(controls.target.y).toBeCloseTo(1, 4);
    expect(controls.target.z).toBeCloseTo(1, 4);
    expect(controls.enabled).toBe(true);
    expect(controls.enableDamping).toBe(true);
    expect(reg.hookCount()).toBe(0); // disposer ran
  });

  it('cancels mid-flight, re-enables controls, and rejects the promise with FlyCancelledError', async () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 10);
    const controls = makeControls();
    const reg = makeRegistrar();

    const handle = flyTo(
      camera,
      controls,
      reg.register,
      { position: { x: 5, y: 5, z: 5 }, target: { x: 1, y: 1, z: 1 } },
      { durationMs: 1000 },
    );

    reg.fire(100); // 10 % through
    handle.cancel();

    await expect(handle.promise).rejects.toBeInstanceOf(FlyCancelledError);
    expect(controls.enabled).toBe(true);
    expect(controls.enableDamping).toBe(true);
    expect(reg.hookCount()).toBe(0);
  });

  it('disables controls and damping while the animation is running', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 10);
    const controls = makeControls();
    const reg = makeRegistrar();

    flyTo(
      camera,
      controls,
      reg.register,
      { position: { x: 1, y: 1, z: 1 }, target: { x: 0, y: 0, z: 0 } },
      { durationMs: 1000 },
    );

    expect(controls.enabled).toBe(false);
    expect(controls.enableDamping).toBe(false);
  });

  it('starts a new flyby cancels an in-flight one only when the caller cancels — flyTo is single-shot per call', () => {
    // Two calls to flyTo create two independent handles. (Cancellation of an
    // in-flight flyby is the caller's responsibility.) This test documents
    // that behavior to prevent regressions if someone tries to make flyTo
    // globally exclusive.
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 10);
    const controls = makeControls();
    const reg = makeRegistrar();

    const a = flyTo(
      camera,
      controls,
      reg.register,
      { position: { x: 1, y: 1, z: 1 }, target: { x: 0, y: 0, z: 0 } },
      { durationMs: 1000 },
    );
    const b = flyTo(
      camera,
      controls,
      reg.register,
      { position: { x: 2, y: 2, z: 2 }, target: { x: 0, y: 0, z: 0 } },
      { durationMs: 1000 },
    );

    expect(reg.hookCount()).toBe(2);

    a.cancel();
    b.cancel();
  });
});
```

- [ ] **Step 2: Run test, verify fail**

```bash
npm run test:run -- tests/unit/lib/three/cameraFlyby.test.ts
```

Expected: FAIL with "flyTo is not exported".

- [ ] **Step 3: Implement `flyTo` and supporting types**

Append to `src/lib/three/cameraFlyby.ts`:

```ts
export class FlyCancelledError extends Error {
  constructor() {
    super('flyTo cancelled');
    this.name = 'FlyCancelledError';
  }
}

export interface OrbitControlsLike {
  target: THREE.Vector3;
  enabled: boolean;
  enableDamping: boolean;
  update: () => void;
  addEventListener: (type: 'start', cb: () => void) => void;
  removeEventListener: (type: 'start', cb: () => void) => void;
}

export type FrameHookRegistrar = (cb: (deltaMs: number) => void) => () => void;

export interface FlyToOptions {
  /** default 1000 — chosen for "intentional, not snappy" feel. */
  durationMs?: number;
  /** default cubic ease-in-out. Pure function on [0,1]. */
  easing?: (t: number) => number;
}

export interface FlyToHandle {
  /** Resolves on completion, rejects with FlyCancelledError on cancel. */
  promise: Promise<void>;
  cancel: () => void;
}

const DEFAULT_DURATION_MS = 1000;
const cubicEaseInOut = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/**
 * Animate a camera + OrbitControls pair from their current pose to `endPose`
 * over `durationMs`. The animation is driven by `addFrameHook` (typically
 * `SplatSceneHandle.addFrameHook`), so the caller's existing render loop
 * advances the tween.
 *
 * While the animation is running:
 *   - controls.enabled is set to false (block user input)
 *   - controls.enableDamping is set to false (avoid post-tween drift)
 * Both are restored on completion or cancellation.
 *
 * Spherical interpolation: the function reads the current spherical state
 * around the *current* target and tweens (radius, phi, theta) plus the
 * target Vector3 — produces a more natural arc than lerping position
 * vectors directly.
 */
export function flyTo(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControlsLike,
  addFrameHook: FrameHookRegistrar,
  endPose: CameraDefault,
  opts: FlyToOptions = {},
): FlyToHandle {
  const durationMs = opts.durationMs ?? DEFAULT_DURATION_MS;
  const easing = opts.easing ?? cubicEaseInOut;

  // Snapshot current state.
  const target0 = controls.target.clone();
  const offset0 = new THREE.Vector3().subVectors(camera.position, controls.target);
  const sph0 = new THREE.Spherical().setFromVector3(offset0);

  const target1 = new THREE.Vector3(endPose.target.x, endPose.target.y, endPose.target.z);
  const offset1 = new THREE.Vector3(
    endPose.position.x - endPose.target.x,
    endPose.position.y - endPose.target.y,
    endPose.position.z - endPose.target.z,
  );
  const sph1 = new THREE.Spherical().setFromVector3(offset1);

  // Save state to restore on completion/cancel.
  const wasEnabled = controls.enabled;
  const wasDamping = controls.enableDamping;
  controls.enabled = false;
  controls.enableDamping = false;

  let elapsed = 0;
  let resolved = false;
  let cancelled = false;
  let resolveFn!: () => void;
  let rejectFn!: (err: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolveFn = res;
    rejectFn = rej;
  });
  // Avoid Vitest "unhandled rejection" noise when the caller doesn't await.
  promise.catch(() => {});

  const restore = () => {
    controls.enabled = wasEnabled;
    controls.enableDamping = wasDamping;
  };

  const tick = (deltaMs: number) => {
    if (resolved || cancelled) return;
    elapsed += deltaMs;
    const t = Math.min(1, elapsed / durationMs);
    const e = easing(t);

    const radius = sph0.radius + (sph1.radius - sph0.radius) * e;
    const phi = sph0.phi + (sph1.phi - sph0.phi) * e;
    // Wrap-aware theta lerp: take the shortest path around the circle.
    let dTheta = sph1.theta - sph0.theta;
    if (dTheta > Math.PI) dTheta -= 2 * Math.PI;
    if (dTheta < -Math.PI) dTheta += 2 * Math.PI;
    const theta = sph0.theta + dTheta * e;

    const newOffset = new THREE.Vector3().setFromSpherical(
      new THREE.Spherical(radius, phi, theta),
    );
    const newTarget = new THREE.Vector3().lerpVectors(target0, target1, e);

    controls.target.copy(newTarget);
    camera.position.copy(newTarget).add(newOffset);
    camera.lookAt(controls.target);

    if (t >= 1) {
      resolved = true;
      restore();
      removeHook();
      resolveFn();
    }
  };

  const removeHook = addFrameHook(tick);

  const cancel = () => {
    if (resolved || cancelled) return;
    cancelled = true;
    restore();
    removeHook();
    rejectFn(new FlyCancelledError());
  };

  return { promise, cancel };
}
```

- [ ] **Step 4: Run test, verify pass**

```bash
npm run test:run -- tests/unit/lib/three/cameraFlyby.test.ts
```

Expected: PASS — 10 tests total.

- [ ] **Step 5: Run full unit suite + type-check**

```bash
npm run test:run
npm run type-check
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/three/cameraFlyby.ts tests/unit/lib/three/cameraFlyby.test.ts
git commit -m "$(cat <<'EOF'
feat(3d): flyTo camera animation driven by SplatScene frame hooks

Tweens camera (radius, polar, azimuth) and orbit target via the
scene's per-frame hook registry. Disables OrbitControls + damping
during the animation, restores both on completion or cancellation.
Cancel rejects the promise with FlyCancelledError.

Wrap-aware azimuth lerp avoids the long-way-around case when the
shortest angular path crosses ±π.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

## Task B4: `BackToOverviewButton` component

**Files:**
- Create: `src/components/BackToOverviewButton.tsx`
- Create: `tests/unit/components/BackToOverviewButton.test.tsx`
- Modify: `src/locales/de/common.json`, `src/locales/en/common.json` (new key `viewer.back_to_overview`)

### Steps

- [ ] **Step 1: Add i18n strings**

Find the existing top-level keys in `src/locales/de/common.json` and `src/locales/en/common.json`. Add a `viewer` namespace (creating it if absent):

DE:

```json
"viewer": {
  "back_to_overview": "Zurück zur Übersicht"
}
```

EN:

```json
"viewer": {
  "back_to_overview": "Back to overview"
}
```

If a `viewer` namespace already exists, merge the key in.

- [ ] **Step 2: Write the failing test**

Create `tests/unit/components/BackToOverviewButton.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../src/lib/i18n';
import { BackToOverviewButton } from '../../../src/components/BackToOverviewButton';

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

describe('BackToOverviewButton', () => {
  it('renders nothing when not visible', () => {
    const { container } = renderWithI18n(
      <BackToOverviewButton visible={false} onClick={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders a button with the localized label when visible', () => {
    renderWithI18n(<BackToOverviewButton visible={true} onClick={() => {}} />);
    expect(screen.getByRole('button', { name: /back to overview|zurück zur übersicht/i })).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    renderWithI18n(<BackToOverviewButton visible={true} onClick={onClick} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Run test, verify fail**

```bash
npm run test:run -- tests/unit/components/BackToOverviewButton.test.tsx
```

Expected: FAIL with "Cannot find module".

- [ ] **Step 4: Implement the component**

Create `src/components/BackToOverviewButton.tsx`:

```tsx
import { useTranslation } from 'react-i18next';

interface Props {
  visible: boolean;
  onClick: () => void;
}

/**
 * Floating "↩ Back to overview" button rendered bottom-right on the public
 * viewer. Visible iff the camera has moved away from the per-event saved
 * default. Clicking flies back to the saved default (handled by the parent).
 */
export function BackToOverviewButton({ visible, onClick }: Props) {
  const { t } = useTranslation();
  if (!visible) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-12 right-4 z-30 rounded bg-white/10 px-3 py-2 text-xs text-white shadow-lg backdrop-blur hover:bg-white/20"
    >
      ↩ {t('viewer.back_to_overview')}
    </button>
  );
}
```

- [ ] **Step 5: Run test, verify pass**

```bash
npm run test:run -- tests/unit/components/BackToOverviewButton.test.tsx
```

Expected: PASS — 3 tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/BackToOverviewButton.tsx tests/unit/components/BackToOverviewButton.test.tsx src/locales/de/common.json src/locales/en/common.json
git commit -m "$(cat <<'EOF'
feat(viewer): BackToOverviewButton component

Floating bottom-right button visible when the camera is away from
the saved default. DE/EN strings under viewer.back_to_overview.
Parent owns the click handler and the visibility state.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

## Task B5: Wire flyby into `EventViewPage` and `SplatViewer`

**Files:**
- Modify: `src/components/SplatViewer.tsx`
- Modify: `src/pages/public/EventViewPage.tsx`

### Steps

- [ ] **Step 1: Update SplatViewer to forward `addFrameHook` and the canvas to the parent**

`SplatViewer` already calls `onSceneReady?.(handle)` after the scene is up, and the parent stores it via `sceneHandleRef`. The new `addFrameHook` is part of the handle, so no SplatViewer prop change is strictly required. However, the parent also needs the canvas DOM element for the cancel-on-pointerdown listener (Task B5 step 2). Surface it via a new optional callback.

Modify `src/components/SplatViewer.tsx`. Add to the `Props` interface:

```ts
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
```

In the component, destructure the prop:

```ts
  onCanvasReady,
```

In the existing scene-init `useEffect`, after `setSceneReady(true)`, fire the new callback:

```ts
        onSceneReady?.(h);
        onCanvasReady?.(canvas);
        setLoading(false);
        setSceneReady(true);
```

(Note: `canvas` is already in scope at this point — it's `canvasRef.current` captured at the top of the effect.)

Add `onCanvasReady` to the effect's dep list — append it next to `onSceneReady`:

```ts
  }, [splatUrl, origin?.x, origin?.y, origin?.z, onSceneReady, onCanvasReady]);
```

- [ ] **Step 2: Wire flyby into `EventViewPage`**

Modify `src/pages/public/EventViewPage.tsx`:

Add imports near the existing imports:

```ts
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
// (replace any subset already imported)
import { flyTo, computeLandingPose, FlyCancelledError } from '../../lib/three/cameraFlyby';
import { BackToOverviewButton } from '../../components/BackToOverviewButton';
import { FALLBACK_CAMERA } from '../../lib/three/cameraDefault';
import * as THREE from 'three';
import type { FlyToHandle } from '../../lib/three/cameraFlyby';
```

Add state and refs near the top of the component (after the existing `sceneHandleRef`):

```ts
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inFlightFlyRef = useRef<FlyToHandle | null>(null);
  const didInitialFlybyRef = useRef(false);
  const [cameraAwayFromDefault, setCameraAwayFromDefault] = useState(false);
```

Add a `useCallback` for the canvas-ready callback:

```ts
  const onCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    canvasRef.current = canvas;
  }, []);
```

Add a helper `flyToTent` near the bottom of the component (above the `if (loadingEvent)` early return):

```ts
  const flyToTent = useCallback(
    (tentPosition: { x: number; y: number; z: number }) => {
      const handle = sceneHandleRef.current;
      if (!handle) return;
      // Cancel any in-flight flyby first.
      inFlightFlyRef.current?.cancel();
      const pose = computeLandingPose(handle.camera, handle.controls.target, tentPosition);
      const fly = flyTo(handle.camera, handle.controls, handle.addFrameHook, pose);
      inFlightFlyRef.current = fly;
      fly.promise
        .then(() => {
          if (inFlightFlyRef.current === fly) inFlightFlyRef.current = null;
        })
        .catch((err) => {
          if (!(err instanceof FlyCancelledError)) throw err;
          if (inFlightFlyRef.current === fly) inFlightFlyRef.current = null;
        });
      setCameraAwayFromDefault(true);

      // Cancel on pointerdown — gives the user instant control during a flyby.
      const canvas = canvasRef.current;
      if (canvas) {
        const onDown = () => {
          fly.cancel();
          canvas.removeEventListener('pointerdown', onDown);
        };
        canvas.addEventListener('pointerdown', onDown, { once: false });
        // Cleanup the listener if the flyby completes before pointerdown.
        fly.promise.finally(() => canvas.removeEventListener('pointerdown', onDown));
      }
    },
    [],
  );
```

Add a similar helper for the back-to-overview path:

```ts
  const flyHome = useCallback(() => {
    const handle = sceneHandleRef.current;
    if (!handle) return;
    inFlightFlyRef.current?.cancel();
    const target = cameraDefault ?? FALLBACK_CAMERA;
    const fly = flyTo(handle.camera, handle.controls, handle.addFrameHook, target);
    inFlightFlyRef.current = fly;
    fly.promise
      .then(() => {
        if (inFlightFlyRef.current === fly) inFlightFlyRef.current = null;
        setCameraAwayFromDefault(false);
      })
      .catch((err) => {
        if (!(err instanceof FlyCancelledError)) throw err;
        if (inFlightFlyRef.current === fly) inFlightFlyRef.current = null;
      });
  }, [cameraDefault]);
```

Add an effect that subscribes to OrbitControls' `start` event so manual user movement also flips the away-from-default flag:

```ts
  useEffect(() => {
    const handle = sceneHandleRef.current;
    if (!handle) return;
    const onStart = () => setCameraAwayFromDefault(true);
    handle.controls.addEventListener('start', onStart);
    return () => {
      handle.controls.removeEventListener('start', onStart);
    };
    // Re-bind when the scene is replaced (which happens when splat_url changes).
  }, [event?.splat_url]);
```

Add an effect for the cold-load deep-link case:

```ts
  useEffect(() => {
    if (didInitialFlybyRef.current) return;
    if (!sceneHandleRef.current || !selectedTent) return;
    const pos = selectedTent.position;
    if (
      typeof pos !== 'object' || pos === null ||
      typeof (pos as { x?: unknown }).x !== 'number'
    ) return;
    // Wait one frame so the initial cameraDefault has been applied.
    queueMicrotask(() => {
      flyToTent(pos as { x: number; y: number; z: number });
      didInitialFlybyRef.current = true;
    });
  }, [selectedTent, flyToTent]);
```

Update the marker click handler in the `<SplatViewer>` JSX:

```tsx
        onMarkerClick={(id) => {
          const tnt = tents.find((x) => x.id === id);
          if (!tnt) return;
          if (tnt.slug === tentSlug) {
            // Toggle: same tent selected → deselect, no flyby.
            selectTentBySlug(null);
            return;
          }
          selectTentBySlug(tnt.slug);
          const pos = tnt.position as unknown;
          if (
            typeof pos === 'object' && pos !== null &&
            typeof (pos as { x?: unknown }).x === 'number' &&
            typeof (pos as { y?: unknown }).y === 'number' &&
            typeof (pos as { z?: unknown }).z === 'number'
          ) {
            flyToTent(pos as { x: number; y: number; z: number });
          }
        }}
```

Add `onCanvasReady={onCanvasReady}` to the `<SplatViewer>` props block.

Wire the `TopBar` `onSelectTent` to the same flyby:

```tsx
        onSelectTent={(tnt) => {
          selectTentBySlug(tnt.slug);
          const pos = tnt.position as unknown;
          if (
            typeof pos === 'object' && pos !== null &&
            typeof (pos as { x?: unknown }).x === 'number' &&
            typeof (pos as { y?: unknown }).y === 'number' &&
            typeof (pos as { z?: unknown }).z === 'number'
          ) {
            flyToTent(pos as { x: number; y: number; z: number });
          }
        }}
```

Render the button next to the existing `SetCameraDefaultButton` (just before the `<footer>`):

```tsx
      <BackToOverviewButton
        visible={cameraAwayFromDefault && cameraDefault != null}
        onClick={flyHome}
      />
```

- [ ] **Step 3: Run type-check + full test suite**

```bash
npm run type-check
npm run test:run
```

Expected: all pass. Existing EventViewPage / SplatViewer tests should be unaffected by the additive changes.

- [ ] **Step 4: Run dev server and smoke-test in a browser**

```bash
npm run dev
```

Visit `http://localhost:5173/<event-slug>` and confirm:

1. Click a sign on the map → camera animates ≈1 s to ~10 m from the tent at a slightly tilted angle.
2. Bottom-right "↩ Back to overview" button appears after the flyby.
3. Click the button → camera animates back to the saved default; button disappears.
4. Manually drag/zoom the camera → button reappears.
5. With a tent open in the side panel, click the marker again → side panel closes, no flyby (toggle path).
6. Search for a tent in the search bar → flyby triggers.
7. Hard refresh on `/<event-slug>/tent/<slug>` → camera applies default first, then flies to the tent on cold load.
8. Click anywhere on the canvas mid-flyby → flyby cancels, controls take over at the intermediate pose.

Stop the dev server with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add src/components/SplatViewer.tsx src/pages/public/EventViewPage.tsx
git commit -m "$(cat <<'EOF'
feat(viewer): tent-flyby on select + back-to-overview button

- Click a sign or pick from the search bar → camera flies to
  10 m from the tent over 1 s, polar clamped to [40°, 75°],
  azimuth preserved.
- Floating "Back to overview" button bottom-right; visible when
  the camera has been moved away from the saved default; click
  flies back over 1 s.
- Pointerdown on the canvas mid-flyby cancels and hands control
  back to the user.
- Cold load on a deep-link tent URL does an initial flyby once
  the scene is ready.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: Push and open PR**

```bash
git push -u origin feat/viewer-flyby
gh pr create --title "feat(viewer): tent-flyby on select + back-to-overview button" --body "$(cat <<'EOF'
## Summary
- New `cameraFlyby` module: `computeLandingPose` (pure) + `flyTo` (driven by the SplatScene per-frame hook registry).
- 1 s cubic ease-in-out animation; preserves azimuth, clamps polar to [40°, 75°], distance fixed at 10 m.
- "Back to overview" button bottom-right when the camera is away from the saved default.
- Pointerdown mid-flyby cancels and returns control to the user.

## Test plan
- [x] Unit: `computeLandingPose` (6 cases) and `flyTo` (4 cases) passing.
- [x] Unit: BackToOverviewButton (3 cases) passing.
- [ ] Manual: marker click → flyby; back-to-overview; manual cancel; cold-load deep-link.
- [ ] Manual: search bar select → flyby works.
- [ ] Manual: re-clicking the open tent toggles the side panel without re-flying.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

# PR-C — Inline "+ Add Photo" for Authorized Users

## Task C1: `useCanEditEvent` hook

**Files:**
- Create: `src/hooks/useCanEditEvent.ts`
- Create: `tests/unit/hooks/useCanEditEvent.test.ts`

### Steps

- [ ] **Step 1: Create branch (off main, after PR-B is merged)**

```bash
git switch main
git pull
git switch -c feat/viewer-inline-upload
```

- [ ] **Step 2: Write the failing test**

Create `tests/unit/hooks/useCanEditEvent.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { profileSingle, eventAdminMaybeSingle } = vi.hoisted(() => ({
  profileSingle: vi.fn(),
  eventAdminMaybeSingle: vi.fn(),
}));

vi.mock('../../../src/lib/supabase', () => {
  // profiles chain: from('profiles').select().eq().single()
  const profileEq = vi.fn().mockReturnValue({ single: profileSingle });
  const profileSelect = vi.fn().mockReturnValue({ eq: profileEq });

  // event_admins chain: from('event_admins').select().eq().eq().maybeSingle()
  const eventAdminEq2 = vi.fn().mockReturnValue({ maybeSingle: eventAdminMaybeSingle });
  const eventAdminEq1 = vi.fn().mockReturnValue({ eq: eventAdminEq2 });
  const eventAdminSelect = vi.fn().mockReturnValue({ eq: eventAdminEq1 });

  return {
    supabase: {
      from: vi.fn((table: string) => {
        if (table === 'profiles') return { select: profileSelect };
        if (table === 'event_admins') return { select: eventAdminSelect };
        throw new Error(`Unexpected table: ${table}`);
      }),
    },
  };
});

vi.mock('../../../src/components/AuthProvider', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../../../src/components/AuthProvider';
import { useCanEditEvent } from '../../../src/hooks/useCanEditEvent';

const useAuthMock = vi.mocked(useAuth);

describe('useCanEditEvent', () => {
  beforeEach(() => {
    profileSingle.mockReset();
    eventAdminMaybeSingle.mockReset();
    useAuthMock.mockReset();
  });

  it('returns canEdit=false and does not fetch when there is no session', async () => {
    useAuthMock.mockReturnValue({
      session: null,
      user: null,
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    const { result } = renderHook(() => useCanEditEvent('evt-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canEdit).toBe(false);
    expect(profileSingle).not.toHaveBeenCalled();
    expect(eventAdminMaybeSingle).not.toHaveBeenCalled();
  });

  it('returns canEdit=true for a global admin without consulting event_admins', async () => {
    useAuthMock.mockReturnValue({
      session: { user: { id: 'u-admin' } } as never,
      user: null, loading: false, signIn: vi.fn(), signOut: vi.fn(),
    });
    profileSingle.mockResolvedValue({
      data: { id: 'u-admin', role: 'admin' as const, full_name: 'A', created_at: '' },
      error: null,
    });

    const { result } = renderHook(() => useCanEditEvent('evt-1'));
    await waitFor(() => expect(result.current.canEdit).toBe(true));
    expect(eventAdminMaybeSingle).not.toHaveBeenCalled();
  });

  it('returns canEdit=true for an editor with an event_admins grant', async () => {
    useAuthMock.mockReturnValue({
      session: { user: { id: 'u-ed' } } as never,
      user: null, loading: false, signIn: vi.fn(), signOut: vi.fn(),
    });
    profileSingle.mockResolvedValue({
      data: { id: 'u-ed', role: 'editor' as const, full_name: 'E', created_at: '' },
      error: null,
    });
    eventAdminMaybeSingle.mockResolvedValue({
      data: { role_in_event: 'editor' },
      error: null,
    });

    const { result } = renderHook(() => useCanEditEvent('evt-1'));
    await waitFor(() => expect(result.current.canEdit).toBe(true));
  });

  it('returns canEdit=false for an editor without an event_admins grant', async () => {
    useAuthMock.mockReturnValue({
      session: { user: { id: 'u-ed' } } as never,
      user: null, loading: false, signIn: vi.fn(), signOut: vi.fn(),
    });
    profileSingle.mockResolvedValue({
      data: { id: 'u-ed', role: 'editor' as const, full_name: 'E', created_at: '' },
      error: null,
    });
    eventAdminMaybeSingle.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useCanEditEvent('evt-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canEdit).toBe(false);
  });

  it('exposes an Error and canEdit=false when event_admins query fails', async () => {
    useAuthMock.mockReturnValue({
      session: { user: { id: 'u-ed' } } as never,
      user: null, loading: false, signIn: vi.fn(), signOut: vi.fn(),
    });
    profileSingle.mockResolvedValue({
      data: { id: 'u-ed', role: 'editor' as const, full_name: 'E', created_at: '' },
      error: null,
    });
    eventAdminMaybeSingle.mockResolvedValue({
      data: null, error: { message: 'rls denied' },
    });

    const { result } = renderHook(() => useCanEditEvent('evt-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canEdit).toBe(false);
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('rls denied');
  });
});
```

- [ ] **Step 3: Run test, verify fail**

```bash
npm run test:run -- tests/unit/hooks/useCanEditEvent.test.ts
```

Expected: FAIL with "Cannot find module".

- [ ] **Step 4: Implement the hook**

Create `src/hooks/useCanEditEvent.ts`:

```ts
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';
import { useProfile } from './useProfile';

export interface UseCanEditEventResult {
  canEdit: boolean;
  loading: boolean;
  error: Error | null;
}

interface State {
  fetchedFor: string | null; // `${eventId}|${profileId}` once decided
  canEdit: boolean;
  error: Error | null;
}

const INITIAL: State = { fetchedFor: null, canEdit: false, error: null };

/**
 * UX gate for "this user can edit photos for this event."
 *
 * Mirrors the storage RLS predicate `is_admin() OR has_event_role(eventId)`:
 * - global admin → canEdit=true (no event_admins fetch)
 * - per-event editor or owner → canEdit=true after a single event_admins lookup
 * - everyone else → canEdit=false
 *
 * This is a UX gate, not a security boundary. The actual boundary is the
 * Storage RLS policy on the `tent-photos` bucket; if this hook is wrong,
 * uploads still get rejected at the database.
 */
export function useCanEditEvent(eventId: string | undefined): UseCanEditEventResult {
  const { session } = useAuth();
  const profileId = session?.user?.id;
  const { profile, loading: profileLoading } = useProfile(profileId);
  const [state, setState] = useState<State>(INITIAL);

  const isAdmin = profile?.role === 'admin';
  const key = eventId && profileId ? `${eventId}|${profileId}` : null;

  useEffect(() => {
    // Reset when inputs become falsy.
    if (!session || !eventId || !profileId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs hook state when inputs become falsy. Long-term: migrate to TanStack Query.
      setState(INITIAL);
      return;
    }
    // Admin path: no fetch needed.
    if (isAdmin) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- derives canEdit from already-fetched profile. Long-term: migrate to TanStack Query.
      setState({ fetchedFor: key, canEdit: true, error: null });
      return;
    }
    // Skip while profile is still loading; we don't yet know if the user is admin.
    if (profileLoading) return;

    let cancelled = false;
    supabase
      .from('event_admins')
      .select('role_in_event')
      .eq('event_id', eventId)
      .eq('profile_id', profileId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        setState({
          fetchedFor: key,
          canEdit: !error && data != null,
          error: error ? new Error(error.message) : null,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [session, eventId, profileId, isAdmin, profileLoading, key]);

  // Loading is derived synchronously: still loading if profile is loading OR
  // we haven't decided for the current (eventId, profileId) tuple yet.
  const loading =
    !!session && !!eventId && !!profileId && (profileLoading || state.fetchedFor !== key);

  return { canEdit: state.canEdit, loading, error: state.error };
}
```

- [ ] **Step 5: Run test, verify pass**

```bash
npm run test:run -- tests/unit/hooks/useCanEditEvent.test.ts
```

Expected: PASS — 5 tests.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useCanEditEvent.ts tests/unit/hooks/useCanEditEvent.test.ts
git commit -m "$(cat <<'EOF'
feat(auth): useCanEditEvent hook for in-viewer photo editing

UX gate that mirrors the storage RLS predicate
`is_admin() OR has_event_role(eventId)`:
- admin profile → canEdit=true with no event_admins fetch
- editor profile + event_admins grant → canEdit=true
- anyone else → canEdit=false

State-tracking pattern (fetchedFor key) avoids stale-loading races.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

## Task C2: Add `reloadKey` to `usePhotos`

**Files:**
- Modify: `src/hooks/usePhotos.ts`
- Modify: `tests/unit/hooks/usePhotos.test.ts`

### Steps

- [ ] **Step 1: Add a failing test**

Open `tests/unit/hooks/usePhotos.test.ts` and append a new test inside the existing `describe`:

```ts
  it('refetches when the optional reloadKey arg changes', async () => {
    // (Reuse the file's existing supabase mock — set it up to resolve twice.)
    // The first render fetches; bumping reloadKey forces another fetch.
    const { result, rerender } = renderHook(
      ({ key }: { key: number }) => usePhotos('tent-1', key),
      { initialProps: { key: 0 } },
    );
    await waitFor(() => expect(result.current.length).toBeGreaterThanOrEqual(0));
    const callsBefore = (await import('../../../src/lib/supabase')).supabase.from as unknown as { mock: { calls: unknown[] } };
    rerender({ key: 1 });
    // The hook should have fired a second supabase.from('tent_photos') call.
    await waitFor(() => {
      expect((callsBefore.mock.calls.filter((c: unknown[]) => c[0] === 'tent_photos')).length).toBeGreaterThanOrEqual(2);
    });
  });
```

If the existing `usePhotos.test.ts` does not import `renderHook` and `waitFor` from `@testing-library/react`, add them.

- [ ] **Step 2: Run test, verify fail**

```bash
npm run test:run -- tests/unit/hooks/usePhotos.test.ts
```

Expected: FAIL — the second fetch never fires because the existing hook ignores extra args.

- [ ] **Step 3: Implement**

Modify `src/hooks/usePhotos.ts`:

```ts
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function usePhotos(tentId: string | undefined, reloadKey: number = 0): string[] {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    if (!tentId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronizes hook state when input becomes falsy; not derived state. Long-term: migrate to TanStack Query.
      setUrls([]);
      return;
    }
    let cancelled = false;
    supabase
      .from('tent_photos')
      .select('storage_path,display_order')
      .eq('tent_id', tentId)
      .order('display_order', { ascending: true })
      .then(({ data }) => {
        if (cancelled || !data) return;
        const result: string[] = data.map((p) => {
          const { data: pub } = supabase.storage.from('tent-photos').getPublicUrl(p.storage_path);
          return pub.publicUrl;
        });
        setUrls(result);
      });
    return () => {
      cancelled = true;
    };
  }, [tentId, reloadKey]);

  return urls;
}
```

- [ ] **Step 4: Run test, verify pass**

```bash
npm run test:run -- tests/unit/hooks/usePhotos.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/usePhotos.ts tests/unit/hooks/usePhotos.test.ts
git commit -m "$(cat <<'EOF'
feat(hooks): usePhotos accepts optional reloadKey to force refetch

Bumping the reloadKey arg refetches the tent's photos. Used by the
new inline upload control in the public viewer to refresh after a
successful upload without subscribing to realtime.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

## Task C3: `AddPhotosControl` component

**Files:**
- Create: `src/components/AddPhotosControl.tsx`
- Create: `tests/unit/components/AddPhotosControl.test.tsx`
- Modify: `src/locales/de/common.json`, `src/locales/en/common.json` (new keys)

### Steps

- [ ] **Step 1: Add i18n strings**

Add to the `side_panel` namespace in both locale files:

DE (`src/locales/de/common.json`):

```json
"side_panel": {
  "...": "...",
  "add_photo": "Foto hinzufügen",
  "manage_photos": "Fotos verwalten",
  "uploading": "Wird hochgeladen…",
  "upload_error": "Upload fehlgeschlagen: {{message}}"
}
```

EN (`src/locales/en/common.json`):

```json
"side_panel": {
  "...": "...",
  "add_photo": "Add photo",
  "manage_photos": "Manage photos",
  "uploading": "Uploading…",
  "upload_error": "Upload failed: {{message}}"
}
```

(Merge into the existing `side_panel` entry; do not duplicate the namespace.)

- [ ] **Step 2: Write the failing test**

Create `tests/unit/components/AddPhotosControl.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../src/lib/i18n';

const { uploadFn, insertPhoto, countHead } = vi.hoisted(() => ({
  uploadFn: vi.fn(),
  insertPhoto: vi.fn(),
  countHead: vi.fn(),
}));

vi.mock('../../../src/lib/supabase', () => {
  // tent_photos chain for count: from('tent_photos').select('id', { head: true, count: 'exact' }).eq('tent_id', x)
  // The select call must accept the options object as a second arg.
  const headEq = vi.fn().mockImplementation(async () => countHead());
  const headSelect = vi.fn().mockReturnValue({ eq: headEq });
  // Same chain also handles insert: from('tent_photos').insert({...})
  const fromTable = {
    select: headSelect,
    insert: insertPhoto,
  };
  // storage chain: storage.from('tent-photos').upload
  const storageBucket = { upload: uploadFn };
  return {
    supabase: {
      from: vi.fn().mockReturnValue(fromTable),
      storage: { from: vi.fn().mockReturnValue(storageBucket) },
    },
  };
});

const { showError, showSuccess } = vi.hoisted(() => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

vi.mock('../../../src/components/ToastProvider', () => ({
  useToast: () => ({ showError, showSuccess }),
}));

import { AddPhotosControl } from '../../../src/components/AddPhotosControl';

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

describe('AddPhotosControl', () => {
  beforeEach(() => {
    uploadFn.mockReset();
    insertPhoto.mockReset();
    countHead.mockReset();
    showError.mockReset();
    showSuccess.mockReset();

    countHead.mockResolvedValue({ count: 0, error: null });
    uploadFn.mockResolvedValue({ data: null, error: null });
    insertPhoto.mockResolvedValue({ data: null, error: null });
  });

  it('renders an "Add photo" button with hidden file input', () => {
    renderWithI18n(<AddPhotosControl eventId="evt-1" tentId="tent-1" onUploaded={() => {}} />);
    expect(screen.getByRole('button', { name: /add photo|foto hinzufügen/i })).toBeInTheDocument();
  });

  it('uploads the chosen file, inserts a row, and calls onUploaded', async () => {
    const onUploaded = vi.fn();
    const user = userEvent.setup();
    renderWithI18n(<AddPhotosControl eventId="evt-1" tentId="tent-1" onUploaded={onUploaded} />);

    const file = new File(['png'], 'photo.png', { type: 'image/png' });
    const input = screen.getByTestId('add-photo-input') as HTMLInputElement;
    await user.upload(input, file);

    await waitFor(() => expect(uploadFn).toHaveBeenCalledTimes(1));
    const [path, uploaded] = uploadFn.mock.calls[0]!;
    expect(path).toMatch(/^evt-1\/tent-1\/[0-9a-f-]+\.png$/);
    expect(uploaded).toBe(file);

    expect(insertPhoto).toHaveBeenCalledTimes(1);
    const row = insertPhoto.mock.calls[0]![0];
    expect(row.tent_id).toBe('tent-1');
    expect(row.storage_path).toBe(path);
    expect(row.display_order).toBe(0);

    expect(onUploaded).toHaveBeenCalledTimes(1);
  });

  it('shows an error toast and does NOT insert when upload fails (e.g. RLS rejection)', async () => {
    uploadFn.mockResolvedValue({ data: null, error: { message: 'permission denied' } });
    const onUploaded = vi.fn();
    const user = userEvent.setup();
    renderWithI18n(<AddPhotosControl eventId="evt-1" tentId="tent-1" onUploaded={onUploaded} />);

    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByTestId('add-photo-input') as HTMLInputElement, file);

    await waitFor(() => expect(showError).toHaveBeenCalledTimes(1));
    expect(showError.mock.calls[0]![0]).toMatch(/permission denied/i);
    expect(insertPhoto).not.toHaveBeenCalled();
    expect(onUploaded).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run test, verify fail**

```bash
npm run test:run -- tests/unit/components/AddPhotosControl.test.tsx
```

Expected: FAIL with "Cannot find module".

- [ ] **Step 4: Implement the component**

Create `src/components/AddPhotosControl.tsx`:

```tsx
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { useToast } from './ToastProvider';

interface Props {
  eventId: string;
  tentId: string;
  onUploaded: () => void;
}

/**
 * Single-photo upload control for the public viewer's SidePanel. Visible
 * only to admins and per-event owners/editors (gated by useCanEditEvent
 * upstream). One file at a time; remove/reorder lives on the admin
 * tent-edit page.
 */
export function AddPhotosControl({ eventId, tentId, onUploaded }: Props) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { showError } = useToast();

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setBusy(true);
    try {
      const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
      const path = `${eventId}/${tentId}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage.from('tent-photos').upload(path, file);
      if (upErr) {
        showError(t('side_panel.upload_error', { message: upErr.message }));
        return;
      }

      // Count existing photos to compute the next display_order. count-only
      // round-trip — cheaper than fetching all rows.
      const { count, error: countErr } = await supabase
        .from('tent_photos')
        .select('id', { count: 'exact', head: true })
        .eq('tent_id', tentId);
      if (countErr) {
        showError(t('side_panel.upload_error', { message: countErr.message }));
        return;
      }

      const { error: insErr } = await supabase.from('tent_photos').insert({
        tent_id: tentId,
        storage_path: path,
        display_order: count ?? 0,
      });
      if (insErr) {
        showError(t('side_panel.upload_error', { message: insErr.message }));
        return;
      }

      onUploaded();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="rounded bg-white/10 px-3 py-1 text-xs hover:bg-white/20 disabled:opacity-50"
      >
        {busy ? t('side_panel.uploading') : `+ ${t('side_panel.add_photo')}`}
      </button>
      <input
        ref={inputRef}
        data-testid="add-photo-input"
        type="file"
        accept="image/*"
        onChange={onChange}
        className="hidden"
      />
    </div>
  );
}
```

- [ ] **Step 5: Run test, verify pass**

```bash
npm run test:run -- tests/unit/components/AddPhotosControl.test.tsx
```

Expected: PASS — 3 tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/AddPhotosControl.tsx tests/unit/components/AddPhotosControl.test.tsx src/locales/de/common.json src/locales/en/common.json
git commit -m "$(cat <<'EOF'
feat(viewer): AddPhotosControl single-photo upload component

One-shot file upload that runs the storage upload + tent_photos
insert and reports failures via the existing ToastProvider. Single
busy state during the operation, no per-file progress. Used inside
the public-viewer SidePanel for admins and per-event editors.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

## Task C4: Wire into `SidePanel` and `EventViewPage`

**Files:**
- Modify: `src/components/SidePanel.tsx`
- Modify: `src/pages/public/EventViewPage.tsx`

### Steps

- [ ] **Step 1: Update SidePanel to render the upload control + manage link**

Modify `src/components/SidePanel.tsx`. Update the props interface:

```ts
interface Props {
  tent: TentWithCategories | null;
  categories: Category[];
  photoUrls: string[];
  onClose: () => void;
  onShare?: () => void;
  /** Required when canEdit is true. */
  eventId?: string;
  canEdit?: boolean;
  onPhotosChanged?: () => void;
}
```

Update imports:

```ts
import { Link } from 'react-router-dom';
import { AddPhotosControl } from './AddPhotosControl';
```

Update destructuring and add a new block after the existing photo-strip JSX (between the photos and the description block):

```tsx
export function SidePanel({
  tent,
  categories,
  photoUrls,
  onClose,
  onShare,
  eventId,
  canEdit = false,
  onPhotosChanged,
}: Props) {
```

Add the editor block:

```tsx
      {canEdit && eventId && tent && onPhotosChanged && (
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

Place this block between the photo-strip `</div>` and the `description` `<p>` so that "Add photo / Manage photos" appears under the photos.

- [ ] **Step 2: Wire `useCanEditEvent` and reload key into `EventViewPage`**

Modify `src/pages/public/EventViewPage.tsx`. Add imports:

```ts
import { useCanEditEvent } from '../../hooks/useCanEditEvent';
```

Inside the component, near the existing hook calls (after `useTents`/`useCategories`):

```ts
  const { canEdit } = useCanEditEvent(event?.id);
  const [photosReloadKey, setPhotosReloadKey] = useState(0);
```

Update the `usePhotos` call:

```ts
  const photoUrls = usePhotos(selectedTent?.id, photosReloadKey);
```

Update the `<SidePanel>` JSX:

```tsx
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

- [ ] **Step 3: Run type-check + full test suite**

```bash
npm run type-check
npm run test:run
```

Expected: all pass. Existing `SidePanel.test.tsx` (if any uses it without the new optional props) keeps working because the new props are all optional with safe defaults.

- [ ] **Step 4: Smoke-test in a browser**

```bash
npm run dev
```

Verify, in this order:

1. Visit a tent on the public viewer **without signing in** → no "Add photo" button, no "Manage photos" link.
2. Sign in as a global admin (`/admin/login`) → return to the public viewer → open a tent → "Add photo" button + "Manage photos" link both appear.
3. Click "Add photo" → file picker opens → choose an image → busy state → success → photo strip refreshes with the new photo at the end.
4. Click "Manage photos" → routes to `/admin/tents/<id>/edit` (existing admin page, unchanged).
5. (If a test fixture exists for a non-admin user with an event_admins grant: sign in as that user, confirm same controls appear. If not, skip — covered by the unit tests.)
6. Repeat with a global editor *without* an event_admins grant → controls hidden.
7. Try an oversized image / network failure (kill the dev tunnel during upload) → toast appears with the error message; busy state clears.

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/components/SidePanel.tsx src/pages/public/EventViewPage.tsx
git commit -m "$(cat <<'EOF'
feat(viewer): inline single-photo upload for authorized users

When an admin or per-event editor/owner opens a tent on the
public viewer, the SidePanel now renders an AddPhotosControl
plus a "Manage photos" deep-link to the admin tent-edit page.
After a successful upload the side panel's photo strip refreshes
via the new usePhotos reloadKey path.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: Push and open PR**

```bash
git push -u origin feat/viewer-inline-upload
gh pr create --title "feat(viewer): inline add-photo for admins and per-event editors" --body "$(cat <<'EOF'
## Summary
- New `useCanEditEvent` hook mirrors the storage RLS predicate (`is_admin() OR has_event_role`).
- New `AddPhotosControl` performs one upload at a time; errors surface through the existing ToastProvider.
- SidePanel renders `AddPhotosControl` + a "Manage photos" deep-link when `canEdit` is true.
- `usePhotos` accepts an optional `reloadKey` to refetch after upload.

## Test plan
- [x] Unit: useCanEditEvent (5 cases) passing.
- [x] Unit: AddPhotosControl (3 cases including RLS-rejection error path) passing.
- [x] Unit: usePhotos refetches when reloadKey changes.
- [ ] Manual: visitor (no session) → no upload UI.
- [ ] Manual: admin signed in → upload + refresh works; "Manage photos" links to admin page.
- [ ] Manual: editor without event_admins grant → no upload UI.
- [ ] Manual: simulated upload failure surfaces a toast.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Plan Self-Review

**Spec coverage check:**
- PR-A (filter hide) — Task A1 covers `selectVisibleMarkers` extraction + wiring + selected-tent exemption ✓
- PR-B (flyby + back-to-overview) — B1 (frame hooks), B2 (computeLandingPose), B3 (flyTo + cancel + sentinel error), B4 (BackToOverviewButton + i18n), B5 (wiring incl. cold-load deep-link, search-bar select, pointerdown cancellation, manual-move-detection via OrbitControls 'start') ✓
- PR-C (inline upload) — C1 (useCanEditEvent), C2 (usePhotos reloadKey), C3 (AddPhotosControl + i18n + RLS-failure toast), C4 (SidePanel + EventViewPage wiring + smoke checklist) ✓
- Spec smoke-checklist items: all surfaced as manual steps in B5/C4 step 4 ✓
- Open future work explicitly *not* implemented (per-event landing config, orphan-storage cleanup, realtime, category-count badges) — kept out of scope ✓

**Type/name consistency check:**
- `selectVisibleMarkers(tents, selectedCategoryIds, selectedTentId)` — same signature in test (A1 step 2), implementation (A1 step 4), and call site (A1 step 6) ✓
- `MarkerData` shape no longer carries `dimmed` from the filter path; `SplatViewer`'s existing dimming-on-selection still kicks in unchanged ✓
- `addFrameHook` signature `(cb: (deltaMs: number) => void) => () => void` matches between SplatScene (B1), flyTo's `FrameHookRegistrar` type (B3), the test stub (B3), and the call sites (B5) ✓
- `event_admins` table + `profile_id` column used consistently in C1 test mock and hook implementation ✓
- `AddPhotosControl` props `{ eventId, tentId, onUploaded }` consistent across test (C3 step 2), implementation (C3 step 4), and call site (C4 step 1) ✓
- `useCanEditEvent` returns `{ canEdit, loading, error }` consistently ✓

**Placeholder scan:** none — no TBD/TODO outside the spec's deferred-future-work bucket; every step has full code; every command is exact. The single `TODO(per-event-config)` in `cameraFlyby.ts` is intentional and tracked.
