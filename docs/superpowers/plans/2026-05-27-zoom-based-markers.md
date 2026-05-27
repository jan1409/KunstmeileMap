# Zoom-Based Marker Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch tent markers between a small dot (no number) and the current full numbered marker based on a single hardcoded zoom threshold, so dense stands no longer overlap at the event's default zoom.

**Architecture:** Single threshold constant `MARKER_DETAIL_ZOOM = 20` in `src/lib/map.ts`. `TentMarker` gains a `variant?: 'dot' | 'full'` prop (default `'full'` for backwards compatibility). `MapView` and `TentMapEditor` each track the live zoom level via a small `useMapEvents({ zoomend })` sub-component and pick the variant per marker on each render. The admin editor's red current-pin is unaffected — only the green neighbor markers swap.

**Tech Stack:** React 19.2 + TypeScript 6 + Vitest 4 + React Testing Library + Leaflet 1.9 + react-leaflet 5. No new dependencies, no DB migration.

**Spec:** [docs/superpowers/specs/2026-05-27-zoom-based-markers-design.md](../specs/2026-05-27-zoom-based-markers-design.md)

**Working branch:** `feat/map-pivot` — the still-open PR #28 against `main`. The work is appended as small fix commits on the same branch (per `feedback_iteration_style.md` — fold tuning into the open PR).

---

## File Structure

### Files to modify

| Path | Change |
|---|---|
| `src/lib/map.ts` | Export new constant `MARKER_DETAIL_ZOOM = 20`. |
| `src/components/TentMarker.tsx` | Add `variant?: 'dot' \| 'full'` prop. `variant='dot'` renders a 24×24 hit-area div with a centered 12×12 colored circle (no number). `variant='full'` is the existing 28×28 numbered behavior. |
| `src/components/MapView.tsx` | Add inline `ZoomTracker` subcomponent using `useMapEvents({ zoomend })`. Track `currentZoom` state seeded from the `zoom` prop. Derive `variant` per marker; pass it to `<TentMarker variant=... />` inside `renderToString`. Switch `iconSize`/`iconAnchor` between `[24,24]/[12,12]` (dot) and `[28,28]/[14,14]` (full). |
| `src/components/TentMapEditor.tsx` | Same `ZoomTracker` pattern. `neighborIcon` accepts a `variant` argument and emits the 12×12 green dot below threshold, the existing 20×20 green numbered badge at/above. **The red current pin (`pinIcon`) is unconditional — stays at 24×24 always.** |
| `tests/unit/lib/map.test.ts` | New describe block + tests asserting `MARKER_DETAIL_ZOOM === 20` and is a number. |
| `tests/unit/components/TentMarker.test.tsx` | New tests for `variant='dot'`: renders 24×24 outer hit area with a 12×12 inner circle; no `display_number` text in the dot variant. |
| `tests/unit/components/MapView.test.tsx` | Extend the `react-leaflet` mock to expose `__mapZoomEndHandler` via `useMapEvents`. New tests: at zoom < 20 markers carry `data-variant="dot"`; firing zoomend with 20 swaps them to `data-variant="full"`. |
| `tests/unit/components/TentMapEditor.test.tsx` | Same `useMapEvents` extension. New test: neighbor markers carry `data-variant="dot"` below threshold, `data-variant="full"` at/above. |
| `tests/manual/map-public-smoke.md` | Append 5 bullets for the new zoom behavior. |
| `tests/manual/map-admin-editor-smoke.md` | Append 3 bullets for green-neighbor swap and red-pin invariance. |

### Files NOT modified

- `src/pages/public/EventViewPage.tsx` — no API change.
- `src/pages/admin/TentEditPage.tsx`, `src/components/TentEditForm.tsx` — no API change.
- Database migrations, generated types, locale JSONs, EventSettings UI.

---

## Task 1 — `MARKER_DETAIL_ZOOM` constant

**Files:**
- Modify: `src/lib/map.ts`
- Modify: `tests/unit/lib/map.test.ts`

- [ ] **Step 1.1: Write the failing test**

Open `tests/unit/lib/map.test.ts`. Add a new import for the constant and a new `describe` block at the bottom of the file:

```ts
import {
  isValidCoord,
  clampZoom,
  computeBounds,
  colorForSlug,
  markerColorForCategories,
  MARKER_DETAIL_ZOOM,
} from '../../../src/lib/map';
```

(Modify the existing import — add `MARKER_DETAIL_ZOOM` to the named-import list.)

Append at the end of the file:

```ts
describe('MARKER_DETAIL_ZOOM', () => {
  it('is the integer zoom level at and above which markers show their display number', () => {
    expect(MARKER_DETAIL_ZOOM).toBe(20);
  });
  it('is an integer', () => {
    expect(Number.isInteger(MARKER_DETAIL_ZOOM)).toBe(true);
  });
});
```

- [ ] **Step 1.2: Run the test to verify it fails**

```bash
pnpm test:run tests/unit/lib/map.test.ts
```

Expected: FAIL — `MARKER_DETAIL_ZOOM` not exported (or undefined).

- [ ] **Step 1.3: Add the constant**

Append at the end of `src/lib/map.ts`:

```ts
/**
 * Zoom threshold at which markers switch from compact dots (below) to full
 * numbered badges (at/above). Calibrated for the Kunstmeile site at Lat 53°:
 * 28px markers are ~2.5m wide at z=20, fitting the 3–4m stand spacing.
 * See docs/superpowers/specs/2026-05-27-zoom-based-markers-design.md.
 */
export const MARKER_DETAIL_ZOOM = 20;
```

- [ ] **Step 1.4: Run the test to verify it passes**

```bash
pnpm test:run tests/unit/lib/map.test.ts
```

Expected: PASS — both new assertions green; the existing tests in this file still pass.

- [ ] **Step 1.5: Commit**

```bash
git add src/lib/map.ts tests/unit/lib/map.test.ts
git commit -m "feat(lib): MARKER_DETAIL_ZOOM threshold for variant switch"
```

---

## Task 2 — `TentMarker` variant prop

**Files:**
- Modify: `src/components/TentMarker.tsx`
- Modify: `tests/unit/components/TentMarker.test.tsx`

- [ ] **Step 2.1: Write the failing tests**

Open `tests/unit/components/TentMarker.test.tsx` and append after the existing `it(...)` blocks (inside the same `describe('TentMarker', () => { ... })`):

```tsx
  it('variant="dot" renders a 24x24 hit-area with a 12x12 inner circle', () => {
    const { container } = render(
      <TentMarker
        displayNumber={42}
        color="#ef4444"
        ariaLabel="Stand 42"
        variant="dot"
      />,
    );
    const outer = container.firstChild as HTMLElement;
    expect(outer.className).toMatch(/\bh-6\b/);
    expect(outer.className).toMatch(/\bw-6\b/);
    const inner = outer.firstChild as HTMLElement;
    expect(inner.className).toMatch(/\bh-3\b/);
    expect(inner.className).toMatch(/\bw-3\b/);
    expect(inner.style.backgroundColor).toBe('rgb(239, 68, 68)');
  });

  it('variant="dot" does NOT render the display number', () => {
    const { container } = render(
      <TentMarker
        displayNumber={42}
        color="#ef4444"
        ariaLabel="Stand 42"
        variant="dot"
      />,
    );
    expect(container.textContent).toBe('');
  });

  it('defaults to variant="full" when omitted', () => {
    const { getByText } = render(
      <TentMarker displayNumber={7} color="#000" ariaLabel="Stand 7" />,
    );
    expect(getByText('7')).toBeInTheDocument();
  });
```

> **Note for the engineer:** The existing tests assume the current rendering (28×28 with number); the third new test ("defaults to full") is the rename of the de-facto current behavior. Do not delete the existing tests; the new ones augment them.

- [ ] **Step 2.2: Run the tests to verify they fail**

```bash
pnpm test:run tests/unit/components/TentMarker.test.tsx
```

Expected: FAIL — the new `variant='dot'` tests fail because the component currently renders a single 28×28 div regardless of any prop.

- [ ] **Step 2.3: Update `TentMarker`**

Replace the contents of `src/components/TentMarker.tsx` with:

```tsx
interface Props {
  displayNumber: number | null;
  color: string;
  ariaLabel: string;
  /**
   * `'full'` (default): 28×28 badge with the display number inside.
   * `'dot'`: 24×24 hit-area wrapper around a 12×12 colored circle, no number.
   * Used by MapView/TentMapEditor to swap detail level on zoom.
   */
  variant?: 'dot' | 'full';
}

/**
 * Pure DOM tent marker. Rendered into a Leaflet `divIcon` via
 * `renderToString` — has no Leaflet runtime dependencies and tests cleanly in
 * jsdom.
 */
export function TentMarker({
  displayNumber,
  color,
  ariaLabel,
  variant = 'full',
}: Props) {
  if (variant === 'dot') {
    // 24×24 outer hit-area for touch accessibility (WCAG 2.5.5),
    // with a 12×12 colored circle centered inside.
    return (
      <div
        aria-label={ariaLabel}
        className="flex h-6 w-6 items-center justify-center"
      >
        <div
          style={{ backgroundColor: color }}
          className="h-3 w-3 rounded-full border-2 border-white shadow"
        />
      </div>
    );
  }
  return (
    <div
      aria-label={ariaLabel}
      style={{ backgroundColor: color }}
      className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs font-semibold text-zinc-900 shadow"
    >
      {displayNumber ?? '·'}
    </div>
  );
}
```

- [ ] **Step 2.4: Run the tests to verify they pass**

```bash
pnpm test:run tests/unit/components/TentMarker.test.tsx
```

Expected: PASS — both the new dot-variant tests and the three pre-existing tests (background color, aria-label, dot-fallback for null displayNumber).

- [ ] **Step 2.5: Type-check + lint**

```bash
pnpm type-check
```

Expected: clean (no errors).

```bash
pnpm lint src/components/TentMarker.tsx tests/unit/components/TentMarker.test.tsx
```

Expected: no new errors. (The repo has a documented 12-error baseline in `routes.tsx` + `TentEditPage.tsx`; you must not add to it.)

- [ ] **Step 2.6: Commit**

```bash
git add src/components/TentMarker.tsx tests/unit/components/TentMarker.test.tsx
git commit -m "feat(viewer): TentMarker gains 'dot' variant for low-zoom rendering"
```

---

## Task 3 — `MapView` zoom-driven variant swap

**Files:**
- Modify: `src/components/MapView.tsx`
- Modify: `tests/unit/components/MapView.test.tsx`

- [ ] **Step 3.1: Extend the react-leaflet mock**

Open `tests/unit/components/MapView.test.tsx`. Replace the `vi.mock('react-leaflet', ...)` block at the top with:

```tsx
vi.mock('react-leaflet', () => ({
  MapContainer: ({
    children,
    center,
    zoom,
  }: {
    children?: React.ReactNode;
    center: [number, number];
    zoom: number;
  }) => (
    <div
      data-testid="map"
      data-center={JSON.stringify(center)}
      data-zoom={zoom}
    >
      {children}
    </div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({
    position,
    icon,
    eventHandlers,
  }: {
    position: [number, number];
    icon?: { options?: { iconSize?: [number, number] } };
    eventHandlers?: { click?: () => void };
  }) => {
    // Surface the variant via the icon's iconSize so tests can assert on it
    // without coupling to renderToString HTML internals.
    const iconSize = icon?.options?.iconSize;
    const variant =
      iconSize && iconSize[0] === 24 ? 'dot' : 'full';
    return (
      <div
        data-testid="marker"
        data-position={JSON.stringify(position)}
        data-variant={variant}
        onClick={() => eventHandlers?.click?.()}
      />
    );
  },
  ZoomControl: () => <div data-testid="zoom-control" />,
  useMapEvents: (handlers: { zoomend?: () => void }) => {
    (globalThis as unknown as { __mapZoomEndHandler?: () => void }).__mapZoomEndHandler =
      handlers.zoomend;
    return null;
  },
}));
```

Also update the `vi.mock('leaflet', ...)` block to return the `iconSize` so the Marker mock can see it:

```tsx
vi.mock('leaflet', () => ({
  default: {
    divIcon: (opts: { iconSize?: [number, number] }) => ({ options: opts }),
  },
}));
```

- [ ] **Step 3.2: Write the failing tests**

Append new test cases inside the existing `describe('MapView', () => { ... })` block:

```tsx
  it('renders markers as "dot" variant when initial zoom is below MARKER_DETAIL_ZOOM', () => {
    const { getAllByTestId } = render(
      <MapView
        tents={SAMPLE_TENTS}
        center={[49.0, 8.4]}
        zoom={18}
        onMarkerClick={() => {}}
      />,
    );
    const markers = getAllByTestId('marker');
    expect(markers).toHaveLength(2);
    markers.forEach((m) => expect(m.getAttribute('data-variant')).toBe('dot'));
  });

  it('renders markers as "full" variant when initial zoom is at MARKER_DETAIL_ZOOM', () => {
    const { getAllByTestId } = render(
      <MapView
        tents={SAMPLE_TENTS}
        center={[49.0, 8.4]}
        zoom={20}
        onMarkerClick={() => {}}
      />,
    );
    getAllByTestId('marker').forEach((m) =>
      expect(m.getAttribute('data-variant')).toBe('full'),
    );
  });

  it('swaps marker variant when the map zoom changes (zoomend event)', async () => {
    const { getAllByTestId } = render(
      <MapView
        tents={SAMPLE_TENTS}
        center={[49.0, 8.4]}
        zoom={18}
        onMarkerClick={() => {}}
      />,
    );
    // Initial: dot variant at zoom 18.
    expect(getAllByTestId('marker')[0]!.getAttribute('data-variant')).toBe(
      'dot',
    );

    // Fire zoomend with a zoom value that crosses the threshold.
    await act(async () => {
      (globalThis as unknown as { __mapSetZoom?: (z: number) => void }).__mapSetZoom?.(
        20,
      );
      (globalThis as unknown as { __mapZoomEndHandler?: () => void }).__mapZoomEndHandler?.();
    });

    expect(getAllByTestId('marker')[0]!.getAttribute('data-variant')).toBe(
      'full',
    );
  });
```

Add to the top of the test file:

```tsx
import { act } from '@testing-library/react';
```

> **Note for the engineer:** The third test uses a `__mapSetZoom` global that we'll wire up by having the `useMapEvents` mock return an object exposing `getZoom`. See Step 3.3 for the matching implementation pattern. If you find a cleaner mock shape, use it — the test's intent is "fire zoomend with a new zoom, observe variant changes."

- [ ] **Step 3.3: Refine the mock to support reading the current zoom**

Replace the `useMapEvents` mock with a version that returns an object exposing `getZoom`, and stash a setter on `globalThis` so tests can drive it:

```tsx
useMapEvents: (handlers: { zoomend?: () => void }) => {
  (globalThis as unknown as { __mapZoomEndHandler?: () => void }).__mapZoomEndHandler =
    handlers.zoomend;
  const g = globalThis as unknown as {
    __currentMockZoom?: number;
    __mapSetZoom?: (z: number) => void;
  };
  g.__currentMockZoom = g.__currentMockZoom ?? 18;
  g.__mapSetZoom = (z: number) => {
    g.__currentMockZoom = z;
  };
  return { getZoom: () => g.__currentMockZoom ?? 18 };
},
```

Also add a `beforeEach` to the describe block that resets the global so tests don't bleed:

```tsx
import { beforeEach } from 'vitest';

describe('MapView', () => {
  beforeEach(() => {
    const g = globalThis as unknown as {
      __currentMockZoom?: number;
      __mapZoomEndHandler?: () => void;
    };
    g.__currentMockZoom = undefined;
    g.__mapZoomEndHandler = undefined;
  });
  // ...existing and new tests
});
```

For the two "initial zoom" tests above, also set the mock zoom inside the test before render:

```tsx
  it('renders markers as "dot" variant when initial zoom is below MARKER_DETAIL_ZOOM', () => {
    (globalThis as unknown as { __currentMockZoom?: number }).__currentMockZoom = 18;
    const { getAllByTestId } = render(/* ... */);
    /* ... */
  });
```

(And `__currentMockZoom = 20` in the "renders markers as full" test.)

- [ ] **Step 3.4: Run the new tests, verify they fail**

```bash
pnpm test:run tests/unit/components/MapView.test.tsx
```

Expected: FAIL — the new tests fail because MapView doesn't yet pick a variant or react to zoomend.

- [ ] **Step 3.5: Implement zoom-driven variant in MapView**

Replace the contents of `src/components/MapView.tsx` with:

```tsx
import { useState } from 'react';
import { MapContainer, Marker, TileLayer, ZoomControl, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { renderToString } from 'react-dom/server';
import 'leaflet/dist/leaflet.css';
import type { TentWithCategories } from '../lib/supabase';
import { isValidCoord, markerColorForCategories, MARKER_DETAIL_ZOOM } from '../lib/map';
import { TentMarker } from './TentMarker';

interface Props {
  tents: TentWithCategories[];
  center: [number, number];
  zoom: number;
  onMarkerClick: (tent: TentWithCategories) => void;
}

/**
 * Internal helper: subscribes to Leaflet's `zoomend` event and reports the
 * current zoom level back to the parent so it can swap marker variants on
 * the MARKER_DETAIL_ZOOM threshold. Renders no DOM of its own.
 */
function ZoomTracker({ onZoomChange }: { onZoomChange: (z: number) => void }) {
  const map = useMapEvents({
    zoomend: () => onZoomChange(map.getZoom()),
  });
  return null;
}

/**
 * Public Leaflet map. Renders one marker per tent with valid coordinates,
 * skipping tents whose lat/lng are null or out of range. Marker color is
 * derived from the tent's first category slug. Below MARKER_DETAIL_ZOOM the
 * marker is a compact dot; at/above it is the full numbered badge.
 * Clicking either invokes `onMarkerClick(tent)` — the parent owns
 * selection / URL state.
 */
export function MapView({ tents, center, zoom, onMarkerClick }: Props) {
  const [currentZoom, setCurrentZoom] = useState<number>(zoom);
  const variant: 'dot' | 'full' =
    currentZoom >= MARKER_DETAIL_ZOOM ? 'full' : 'dot';

  const placed = tents.filter(
    (t): t is TentWithCategories & { lat: number; lng: number } =>
      t.lat != null && t.lng != null && isValidCoord(t.lat, t.lng),
  );

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      maxZoom={22}
      zoomControl={false}
      className="h-full w-full"
    >
      <ZoomTracker onZoomChange={setCurrentZoom} />
      <ZoomControl position="bottomleft" />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxNativeZoom={19}
        maxZoom={22}
      />
      {placed.map((t) => {
        const color = markerColorForCategories(t.categories ?? []);
        const icon = L.divIcon({
          html: renderToString(
            <TentMarker
              displayNumber={t.display_number}
              color={color}
              ariaLabel={t.name}
              variant={variant}
            />,
          ),
          className: '',
          iconSize: variant === 'dot' ? [24, 24] : [28, 28],
          iconAnchor: variant === 'dot' ? [12, 12] : [14, 14],
        });
        return (
          <Marker
            key={t.id}
            position={[t.lat, t.lng]}
            icon={icon}
            eventHandlers={{ click: () => onMarkerClick(t) }}
          />
        );
      })}
    </MapContainer>
  );
}
```

- [ ] **Step 3.6: Run the MapView tests to verify they pass**

```bash
pnpm test:run tests/unit/components/MapView.test.tsx
```

Expected: PASS — all 6 tests (the original 3 plus the 3 new ones for variant-by-initial-zoom and variant-swap-on-zoomend).

- [ ] **Step 3.7: Run the full suite + type-check + lint**

```bash
pnpm test:run
```

Expected: 175 + 5 new = 180 tests passing across 34 files. (1 new constant-test in `map.test.ts`, 2 new in `TentMarker.test.tsx`, 3 new in `MapView.test.tsx`; minus 1 because the old "renders dot for null displayNumber" in TentMarker test was kept and the new "defaults to variant=full" is an addition — net +5.)

Cross-check actual count after run; if differs by 1–2 it's likely because of how many existing tests Vitest counted. The success criterion is "0 failures."

```bash
pnpm type-check
```

Expected: clean.

```bash
pnpm lint
```

Expected: 12 errors (the documented baseline), 0 new.

- [ ] **Step 3.8: Commit**

```bash
git add src/components/MapView.tsx tests/unit/components/MapView.test.tsx
git commit -m "$(cat <<'EOF'
feat(viewer): MapView swaps marker variant on MARKER_DETAIL_ZOOM crossing

Adds a ZoomTracker subcomponent (useMapEvents zoomend) and a currentZoom
state seeded from the zoom prop. Markers below MARKER_DETAIL_ZOOM render
as 24×24-hit-area dots (12×12 visual); at/above the threshold they
render as the existing 28×28 numbered badge.
EOF
)"
```

---

## Task 4 — `TentMapEditor` neighbor markers swap

**Files:**
- Modify: `src/components/TentMapEditor.tsx`
- Modify: `tests/unit/components/TentMapEditor.test.tsx`

- [ ] **Step 4.1: Extend the TentMapEditor react-leaflet mock**

Open `tests/unit/components/TentMapEditor.test.tsx`. Find the `vi.mock('react-leaflet', ...)` block. The current `Marker` mock receives `position`, `draggable`, and `eventHandlers`. Extend it to:

1. Expose `icon.options.iconSize` (so tests can read the variant via dimensions).
2. Add a `data-variant` attribute as in MapView's mock.
3. Keep the existing `dragend`-via-click test behavior.

Replace the `Marker` mock with:

```tsx
  Marker: ({
    position,
    draggable,
    icon,
    eventHandlers,
  }: {
    position: [number, number];
    draggable?: boolean;
    icon?: { options?: { iconSize?: [number, number] } };
    eventHandlers?: {
      dragend?: (e: {
        target: { getLatLng: () => { lat: number; lng: number } };
      }) => void;
    };
  }) => {
    const iconSize = icon?.options?.iconSize;
    const variant =
      iconSize && iconSize[0] === 24 ? 'dot' : 'full';
    return (
      <button
        data-testid="marker"
        data-position={JSON.stringify(position)}
        data-variant={variant}
        onClick={() =>
          eventHandlers?.dragend?.({
            target: {
              getLatLng: () => ({
                lat: position[0] + 0.01,
                lng: position[1] + 0.01,
              }),
            },
          })
        }
      >
        {draggable ? 'draggable' : 'static'}
      </button>
    );
  },
```

Add `useMapEvents` zoom handling to the same mock object (alongside the existing click-handler stash):

```tsx
  useMapEvents: (handlers: {
    click?: (e: { latlng: { lat: number; lng: number } }) => void;
    zoomend?: () => void;
  }) => {
    const g = globalThis as unknown as {
      __mapClickHandler?: typeof handlers.click;
      __mapZoomEndHandler?: () => void;
      __currentMockZoom?: number;
    };
    if (handlers.click) g.__mapClickHandler = handlers.click;
    if (handlers.zoomend) g.__mapZoomEndHandler = handlers.zoomend;
    g.__currentMockZoom = g.__currentMockZoom ?? 18;
    return { getZoom: () => g.__currentMockZoom ?? 18 };
  },
```

Update the `vi.mock('leaflet', ...)` block to expose `iconSize`:

```tsx
vi.mock('leaflet', () => ({
  default: {
    divIcon: vi.fn((opts: { iconSize?: [number, number] }) => ({ options: opts })),
  },
}));
```

- [ ] **Step 4.2: Write the failing tests**

Add a `beforeEach` to the describe block that resets the global zoom mock (mirror the one in MapView.test.tsx):

```tsx
import { beforeEach } from 'vitest';

describe('TentMapEditor', () => {
  beforeEach(() => {
    const g = globalThis as unknown as {
      __currentMockZoom?: number;
      __mapZoomEndHandler?: () => void;
      __mapClickHandler?: unknown;
    };
    g.__currentMockZoom = undefined;
    g.__mapZoomEndHandler = undefined;
    g.__mapClickHandler = undefined;
  });
  // existing and new tests below
});
```

Append the following test cases inside the `describe`:

```tsx
  it('renders neighbor tents as "dot" variant below MARKER_DETAIL_ZOOM', () => {
    (globalThis as unknown as { __currentMockZoom?: number }).__currentMockZoom = 18;
    const { getAllByTestId } = render(
      <TentMapEditor
        lat={null}
        lng={null}
        defaultCenter={[49.0, 8.4]}
        defaultZoom={18}
        onChange={() => {}}
        otherTents={[
          { id: 'a', name: 'A', display_number: 1, lat: 49.001, lng: 8.401 },
          { id: 'b', name: 'B', display_number: 2, lat: 49.002, lng: 8.402 },
        ]}
      />,
    );
    const markers = getAllByTestId('marker');
    // Both neighbors should be dot-variant. No red current pin because lat/lng are null.
    expect(markers).toHaveLength(2);
    markers.forEach((m) => expect(m.getAttribute('data-variant')).toBe('dot'));
  });

  it('renders neighbor tents as "full" variant at MARKER_DETAIL_ZOOM and above', () => {
    (globalThis as unknown as { __currentMockZoom?: number }).__currentMockZoom = 20;
    const { getAllByTestId } = render(
      <TentMapEditor
        lat={null}
        lng={null}
        defaultCenter={[49.0, 8.4]}
        defaultZoom={20}
        onChange={() => {}}
        otherTents={[
          { id: 'a', name: 'A', display_number: 1, lat: 49.001, lng: 8.401 },
        ]}
      />,
    );
    expect(getAllByTestId('marker')[0]!.getAttribute('data-variant')).toBe(
      'full',
    );
  });

  it('keeps the red current pin at full size regardless of zoom', () => {
    (globalThis as unknown as { __currentMockZoom?: number }).__currentMockZoom = 18;
    const { getAllByTestId } = render(
      <TentMapEditor
        lat={49.0}
        lng={8.4}
        defaultCenter={[49.0, 8.4]}
        defaultZoom={18}
        onChange={() => {}}
        otherTents={[
          { id: 'a', name: 'A', display_number: 1, lat: 49.001, lng: 8.401 },
        ]}
      />,
    );
    // Two markers expected: the red current pin (always 'full' size 24×24 ⇒
    // mock reports 'full' since iconSize[0] !== 24… wait, the red pin IS
    // 24×24. The mock's variant heuristic flags iconSize[0] === 24 as 'dot'.
    // So we must distinguish red-pin from neighbor-dot a different way.
    // Use the `draggable` attribute: the red pin is the only draggable Marker.
    const markers = getAllByTestId('marker');
    const draggable = markers.find((m) => m.textContent === 'draggable');
    const neighbors = markers.filter((m) => m.textContent === 'static');
    expect(draggable).toBeDefined();
    expect(neighbors).toHaveLength(1);
    expect(neighbors[0]!.getAttribute('data-variant')).toBe('dot');
  });
```

> **Critical engineer note about the mock heuristic:** The Marker mock uses `iconSize[0] === 24` to detect 'dot' variant. But the red current pin is ALSO 24×24 (the existing `pinIcon` builds a 24×24 divIcon — see `src/components/TentMapEditor.tsx` line ~46). So the mock would mis-classify the red pin as a dot, breaking the third test.
>
> **Fix in Step 4.3:** when refactoring `pinIcon`, change its `iconSize` to `[26, 26]` (or `[28, 28]`) so the mock's variant heuristic only reports 'dot' for neighbor-dot markers, not the red pin. This is also visually closer to the public MapView's full marker (28×28). Update the in-source comment to note the heuristic depends on this size.
>
> Alternatively, replace the heuristic with a dedicated `data-variant` injected by the divIcon's `className`, e.g., `className: variant === 'dot' ? 'marker-dot' : 'marker-full'`, and let the mock read it from there. Either approach is fine — pick the one you can implement most cleanly. The plan below assumes the size-change approach.

- [ ] **Step 4.3: Update `TentMapEditor`**

Replace the contents of `src/components/TentMapEditor.tsx` with:

```tsx
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapContainer, Marker, TileLayer, ZoomControl, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MARKER_DETAIL_ZOOM } from '../lib/map';

export interface OtherTent {
  id: string;
  name: string;
  display_number: number | null;
  lat: number;
  lng: number;
}

interface Props {
  lat: number | null;
  lng: number | null;
  defaultCenter: [number, number];
  defaultZoom: number;
  onChange: (next: { lat: number | null; lng: number | null }) => void;
  /** Other already-placed tents from the same event, shown in green for spatial context. */
  otherTents?: OtherTent[];
}

function MapClickHandler({
  onClick,
}: {
  onClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click: (e: { latlng: { lat: number; lng: number } }) => {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function ZoomTracker({ onZoomChange }: { onZoomChange: (z: number) => void }) {
  const map = useMapEvents({
    zoomend: () => onZoomChange(map.getZoom()),
  });
  return null;
}

export function TentMapEditor({
  lat,
  lng,
  defaultCenter,
  defaultZoom,
  onChange,
  otherTents = [],
}: Props) {
  const { t } = useTranslation();
  const hasCoord = lat != null && lng != null;
  const markerPos: [number, number] = hasCoord ? [lat, lng] : defaultCenter;

  const [currentZoom, setCurrentZoom] = useState<number>(defaultZoom);
  const neighborVariant: 'dot' | 'full' =
    currentZoom >= MARKER_DETAIL_ZOOM ? 'full' : 'dot';

  // Red pin (current tent). 26×26 so the test-mock's `iconSize[0] === 24`
  // dot-heuristic only matches the green neighbor-dots, not this one.
  const pinIcon = useMemo(
    () =>
      L.divIcon({
        html:
          '<div style="height:26px;width:26px;border-radius:9999px;background:#ef4444;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>',
        className: '',
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      }),
    [],
  );

  // Green neighbor markers — dot below threshold (24×24 hit area, 12×12
  // visual), full numbered badge at/above (20×20).
  function neighborIcon(displayNumber: number | null, variant: 'dot' | 'full') {
    if (variant === 'dot') {
      return L.divIcon({
        html:
          '<div style="display:flex;align-items:center;justify-content:center;height:24px;width:24px;"><div style="height:12px;width:12px;border-radius:9999px;background:#22c55e;border:2px solid white;box-shadow:0 1px 2px rgba(0,0,0,0.35);"></div></div>',
        className: '',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
    }
    const label = displayNumber != null ? String(displayNumber) : '';
    return L.divIcon({
      html: `<div style="height:20px;width:20px;border-radius:9999px;background:#22c55e;border:2px solid white;box-shadow:0 1px 2px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;color:#052e16;font-size:10px;font-weight:600;">${label}</div>`,
      className: '',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <label className="flex-1 text-xs">
          <span className="block text-white/60">Lat</span>
          <input
            type="number"
            step="any"
            value={lat ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? null : Number(e.target.value);
              onChange({ lat: v, lng });
            }}
            className="input mt-1"
            aria-label="Lat"
          />
        </label>
        <label className="flex-1 text-xs">
          <span className="block text-white/60">Lng</span>
          <input
            type="number"
            step="any"
            value={lng ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? null : Number(e.target.value);
              onChange({ lat, lng: v });
            }}
            className="input mt-1"
            aria-label="Lng"
          />
        </label>
      </div>

      <div className="h-64 w-full overflow-hidden rounded border border-white/10">
        <MapContainer
          center={hasCoord ? markerPos : defaultCenter}
          zoom={defaultZoom}
          maxZoom={22}
          zoomControl={false}
          className="h-full w-full"
        >
          <ZoomTracker onZoomChange={setCurrentZoom} />
          <ZoomControl position="bottomleft" />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxNativeZoom={19}
            maxZoom={22}
          />
          <MapClickHandler onClick={(lt, ln) => onChange({ lat: lt, lng: ln })} />
          {otherTents.map((o) => (
            <Marker
              key={o.id}
              position={[o.lat, o.lng]}
              icon={neighborIcon(o.display_number, neighborVariant)}
              interactive={false}
              keyboard={false}
              title={o.name}
            />
          ))}
          {hasCoord && (
            <Marker
              position={markerPos}
              icon={pinIcon}
              draggable
              eventHandlers={{
                dragend: (e: {
                  target: { getLatLng: () => { lat: number; lng: number } };
                }) => {
                  const p = e.target.getLatLng();
                  onChange({ lat: p.lat, lng: p.lng });
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      <button
        type="button"
        onClick={() => onChange({ lat: null, lng: null })}
        disabled={!hasCoord}
        className="rounded bg-white/10 px-3 py-1 text-xs disabled:opacity-50"
      >
        {t('admin.tent.clear_coords')}
      </button>
    </div>
  );
}
```

- [ ] **Step 4.4: Run the TentMapEditor tests to verify they pass**

```bash
pnpm test:run tests/unit/components/TentMapEditor.test.tsx
```

Expected: PASS — all existing tests plus the 3 new ones.

- [ ] **Step 4.5: Run the full suite + type-check + lint**

```bash
pnpm test:run
pnpm type-check
pnpm lint
```

Expected: full suite green (~178–180 tests), type-check clean, lint at the 12-error baseline (no new errors).

If `pnpm lint` reports issues in `TentMapEditor.tsx`, the most likely culprit is the `interactive` / `keyboard` boolean props on Marker — react-leaflet v5 accepts them as `false` literals; if TS complains, cast: `interactive={false as never}`. Verify before resorting to a cast.

- [ ] **Step 4.6: Commit**

```bash
git add src/components/TentMapEditor.tsx tests/unit/components/TentMapEditor.test.tsx
git commit -m "$(cat <<'EOF'
feat(admin): TentMapEditor neighbor markers swap on MARKER_DETAIL_ZOOM

Green neighbor markers render as 24×24-hit-area dots below z=20 and as
the existing 20×20 numbered badge at/above. Red current pin bumped from
24×24 to 26×26 so the test mock's iconSize heuristic distinguishes it
from neighbor dots. Red pin variant is invariant — the admin always
needs it prominent during placement.
EOF
)"
```

---

## Task 5 — Manual smoke checklists

**Files:**
- Modify: `tests/manual/map-public-smoke.md`
- Modify: `tests/manual/map-admin-editor-smoke.md`

- [ ] **Step 5.1: Append to public smoke checklist**

Open `tests/manual/map-public-smoke.md`. Append at the end (under a new heading):

```markdown
## Zoom-based marker detail (added 2026-05-27)

- [ ] At the event's default zoom (typically 18), all tents render as small colored dots without numbers visible.
- [ ] Zooming in once with the + button (to zoom 19) keeps the dots — still no numbers.
- [ ] Zooming in once more (to zoom 20) switches every marker to the full numbered badge.
- [ ] Zooming back out crosses the threshold the other way and dots return.
- [ ] Filter by category still hides/shows the dots correctly.
- [ ] Clicking a dot opens the SidePanel for that tent (same behavior as clicking a full marker).
- [ ] On a touch device, a single tap on a dot reliably opens the SidePanel (hit-area is 24×24 px even though the visual is 12×12).
```

- [ ] **Step 5.2: Append to admin editor smoke checklist**

Open `tests/manual/map-admin-editor-smoke.md`. Append at the end (under a new heading):

```markdown
## Zoom-based neighbor markers (added 2026-05-27)

- [ ] At the event's default zoom, neighboring already-placed tents appear as small green dots (no numbers).
- [ ] Zooming in past zoom 20 reveals the green numbered badges for the same neighbors.
- [ ] The red current pin (the tent you are placing) keeps its size at all zoom levels — never becomes a dot.
- [ ] Clicking a green neighbor dot does nothing (they are non-interactive context markers).
- [ ] Dragging the red pin still works at any zoom.
```

- [ ] **Step 5.3: Commit**

```bash
git add tests/manual/map-public-smoke.md tests/manual/map-admin-editor-smoke.md
git commit -m "docs(manual): smoke entries for zoom-based marker detail"
```

---

## Task 6 — Push and verify on Vercel preview

- [ ] **Step 6.1: Push to the existing PR branch**

```bash
git push
```

Expected: `feat/map-pivot` updated on origin; PR #28 picks up the new commits automatically. Vercel will rebuild the preview (`kunstmeile-map-git-feat-map-pivot-kunstmeile.vercel.app`) in ~1–2 minutes.

- [ ] **Step 6.2: User manual smoke against the updated preview**

Stop and ask the user to run the new sections of both manual smoke checklists against the Vercel preview, on at least one desktop and one mobile device.

If anything fails the user reports back, fix it as an additional commit on the same branch (per the established iteration pattern) — do not open a new PR.

---

## Self-Review

**Spec coverage (each requirement from the spec → which task implements it):**

- MP-Z-001 (threshold-based icon swap): T1 + T2 + T3 + T4.
- MP-Z-002 (`MARKER_DETAIL_ZOOM = 20` in `src/lib/map.ts`): T1.
- MP-Z-003 (12×12 dot, category-colored, 2px white border, no number; tooltip via `title` prop): T2 (TentMarker `variant='dot'`); T4 (neighbor dot uses inline style, title prop already in place on the neighbor `<Marker title={o.name}>`).
- MP-Z-004 (both variants clickable, same behavior): the dot variant in MapView has the same `eventHandlers={{ click: ... }}` as the full variant (T3); neighbors stay `interactive={false}` (T4) — that matches MP-Z-005's "no-op on neighbors."
- MP-Z-005 (red pin invariant; green neighbors swap): T4 (red `pinIcon` unconditional; `neighborIcon` accepts variant).
- MP-Z-006 (sizing math): documented in the constant's JSDoc comment (T1) and in the spec itself.
- Test requirements: T1 (lib test), T2 (TentMarker dot test), T3 (MapView initial-zoom + zoomend test), T4 (TentMapEditor neighbor-variant + red-pin-invariant tests).
- Manual smoke: T5.
- Acceptance criteria: T6 (preview-push) + manual smoke run.

**Placeholder scan:** No "TBD", "TODO", or "implement later" in the steps. The note about the mock heuristic in Step 4.2 is concrete (engineer can pick either the size-bump or the className approach) and Step 4.3 implements the size-bump explicitly.

**Type consistency:**

- `MARKER_DETAIL_ZOOM`: exported as `number` from `src/lib/map.ts` (Task 1), imported in MapView (T3) and TentMapEditor (T4). Same name throughout.
- `variant: 'dot' | 'full'`: introduced in TentMarker (T2), reused as a local type alias in MapView (T3) and TentMapEditor (T4). Same string literals throughout.
- `OtherTent` type: unchanged from current source — T4 doesn't modify its shape, just consumes `display_number` in `neighborIcon`.
- `pinIcon` iconSize change from `[24,24]` to `[26,26]`: documented in the commit message and the in-source comment so future readers know why.

No drift; implementation can proceed.
