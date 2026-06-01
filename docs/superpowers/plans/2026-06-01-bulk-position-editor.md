# Bulk Position Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desktop-only admin page at `/admin/events/:eventSlug/positions` that shows all placed tents of an event on one large map, lets editors drag markers to fine-tune positions, stages changes in memory, and commits them in a single batch save.

**Architecture:** One new lazy-loaded admin page (`PositionsPage`) composed of two new components (`PositionsTentList` + `PositionsMap`) and one new hook (`useDirtyPositions`). The page loads all tents via the existing `useTents(event.id)` hook, splits them into placed / unplaced sets, and gives `useDirtyPositions` the original coords. On drag, the hook stores the new coords keyed by tent id. On save, the page fires N parallel `supabase.from('tents').update({lat,lng}).eq('id',id)` calls via `Promise.allSettled`, then refetches. No new DB columns, no migrations.

**Tech Stack:** React 19.2 + TypeScript 6 + Vitest 4 + React Testing Library + Leaflet 1.9 + react-leaflet 5 + react-router-dom 7 + i18next 26. No new dependencies.

**Spec:** [docs/superpowers/specs/2026-06-01-bulk-position-editor-design.md](../specs/2026-06-01-bulk-position-editor-design.md)

**Working branch:** `feat/positions-editor` — new feature branch off `main`. One PR.

---

## File Structure

### Files to create

| Path | Responsibility |
|---|---|
| `src/hooks/useDirtyPositions.ts` | Pure-React hook tracking per-tent staged coord edits against an immutable `originals` snapshot. Exposes `set`, `revert`, `revertAll`, `commit(ids)`, `getCoords`, `isDirty`, `dirtyIds`, `dirtyCount`. |
| `src/components/PositionsTentList.tsx` | Left-rail list of all tents in the event. Two sections: "Placed (N)" with optional per-row revert button, and "Unplaced (M)" (read-only). Clicking a placed row fires `onSelect(id)`. |
| `src/components/PositionsMap.tsx` | Leaflet map with one draggable marker per placed tent. Drag fires `onPositionChange(id, lat, lng)`. Dirty markers show a yellow ring + always-visible number label. `focusTentId` triggers `map.flyTo`. Clicking blank map does nothing. |
| `src/pages/admin/PositionsPage.tsx` | Page shell. Mobile gate, data loading, dirty-state, save+discard footer, navigation guard. |
| `tests/unit/hooks/useDirtyPositions.test.ts` | Hook tests. |
| `tests/unit/components/PositionsTentList.test.tsx` | Component tests. |
| `tests/unit/components/PositionsMap.test.tsx` | Component tests using the same `react-leaflet` mock pattern as `MapView.test.tsx`. |
| `tests/unit/pages/PositionsPage.test.tsx` | Page integration tests with supabase + matchMedia mocks. |
| `tests/manual/positions-editor-smoke.md` | Manual desktop smoke checklist. |

### Files to modify

| Path | Change |
|---|---|
| `src/routes.tsx` | Lazy-import `PositionsPage`, add route `events/:eventSlug/positions` wrapped in `RequireEventRole minRole="contributor"` (contributors view read-only; editors can drag/save). |
| `src/pages/admin/EventListPage.tsx` | Add "Positions" link to the row-actions cell, between "Manage" and "Categories", with Tailwind class `hidden md:inline-block` so mobile users don't see it. |
| `src/locales/en/common.json` | Add `admin.positions.*` namespace + `admin.event_list.action_positions`. |
| `src/locales/de/common.json` | Same keys, German copy. |

### Files NOT modified

- No DB migrations, no `supabase/migrations/*` change. `tents.lat`/`lng` already exist.
- No generated types change — column types unchanged.
- No public-facing map (`MapView.tsx`) change.
- No existing tent-edit form change.

---

## Task 1 — Branch + i18n keys (EN + DE)

**Files:**
- Modify: `src/locales/en/common.json`
- Modify: `src/locales/de/common.json`

i18n is intentionally done first: every component below references these keys, and adding them upfront means no later step needs to be split across files.

- [ ] **Step 1.1: Create the working branch**

```bash
git checkout main
git pull --ff-only
git checkout -b feat/positions-editor
```

- [ ] **Step 1.2: Add the `admin.event_list.action_positions` key (EN)**

Open `src/locales/en/common.json`. Locate the `admin.event_list` object (currently has keys `heading`, `new_event`, `col_*`, `action_manage`, `action_categories`, `action_settings`, `action_duplicate`).

Insert `"action_positions": "Positions",` immediately after `"action_manage": "Manage",`:

```json
"event_list": {
  "heading": "Events",
  "new_event": "+ New event",
  "col_slug": "Slug",
  "col_title": "Title",
  "col_year": "Year",
  "col_status": "Status",
  "col_featured": "Featured",
  "action_manage": "Manage",
  "action_positions": "Positions",
  "action_categories": "Categories",
  "action_settings": "Settings",
  "action_duplicate": "Duplicate"
},
```

- [ ] **Step 1.3: Add the `admin.positions` namespace (EN)**

In the same file, add a new top-level key under `admin` (anywhere inside the `admin` object — placing it directly after `admin.users` keeps it next to other event-scoped pages):

```json
"positions": {
  "heading": "Positions — {{title}}",
  "placed_heading": "Placed ({{count}})",
  "unplaced_heading": "Not placed ({{count}})",
  "placed_empty": "No tents placed yet.",
  "revert_aria": "Revert {{name}} to saved position",
  "save_button": "Save changes ({{count}})",
  "saving": "Saving…",
  "discard_button": "Discard all",
  "discard_confirm_heading": "Discard {{count}} changes?",
  "discard_confirm_body": "All unsaved position changes will be lost.",
  "discard_confirm_submit": "Discard",
  "discard_confirm_cancel": "Cancel",
  "save_success": "{{count}} positions saved.",
  "save_partial_error": "{{ok}} of {{total}} saved. {{failed}} failed: {{message}}",
  "nav_guard_message": "You have unsaved position changes. Leave anyway?",
  "mobile_gate_title": "Desktop screen required",
  "mobile_gate_body": "This view requires a desktop screen.",
  "mobile_gate_link": "Open tent list"
}
```

- [ ] **Step 1.4: Add the same keys in German**

Open `src/locales/de/common.json`. Insert into `admin.event_list`, after `"action_manage"`:

```json
"action_positions": "Positionen",
```

Add the German `admin.positions` namespace at the same nesting level as EN:

```json
"positions": {
  "heading": "Positionen — {{title}}",
  "placed_heading": "Platziert ({{count}})",
  "unplaced_heading": "Nicht platziert ({{count}})",
  "placed_empty": "Noch keine Stände platziert.",
  "revert_aria": "{{name}} auf gespeicherte Position zurücksetzen",
  "save_button": "Änderungen speichern ({{count}})",
  "saving": "Wird gespeichert…",
  "discard_button": "Alle verwerfen",
  "discard_confirm_heading": "{{count}} Änderungen verwerfen?",
  "discard_confirm_body": "Alle nicht gespeicherten Positionsänderungen gehen verloren.",
  "discard_confirm_submit": "Verwerfen",
  "discard_confirm_cancel": "Abbrechen",
  "save_success": "{{count}} Positionen gespeichert.",
  "save_partial_error": "{{ok}} von {{total}} gespeichert. {{failed}} fehlgeschlagen: {{message}}",
  "nav_guard_message": "Du hast nicht gespeicherte Positionsänderungen. Trotzdem verlassen?",
  "mobile_gate_title": "Desktopbildschirm erforderlich",
  "mobile_gate_body": "Diese Ansicht benötigt einen Desktopbildschirm.",
  "mobile_gate_link": "Standliste öffnen"
}
```

- [ ] **Step 1.5: Verify both files still parse**

```bash
pnpm tsc --noEmit
```

Expected: PASS (no JSON parse errors). The TS compiler also type-checks the i18n schema if your tsconfig includes them; if it does not, `node -e "JSON.parse(require('fs').readFileSync('src/locales/en/common.json'))"` works as a fallback.

- [ ] **Step 1.6: Commit**

```bash
git add src/locales/en/common.json src/locales/de/common.json
git commit -m "feat(i18n): add admin.positions namespace and event-list positions action"
```

---

## Task 2 — `useDirtyPositions` hook

**Files:**
- Create: `src/hooks/useDirtyPositions.ts`
- Create: `tests/unit/hooks/useDirtyPositions.test.ts`

This hook owns all in-memory edit state. Keep it pure — no Supabase, no async, no side-effects beyond the `useState` it owns. The page calls `commit(ids)` explicitly after a successful save; the hook does NOT auto-reset when `originals` reference changes (avoids clobbering an in-flight edit if the parent refetches).

- [ ] **Step 2.1: Write the failing tests**

Create `tests/unit/hooks/useDirtyPositions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDirtyPositions } from '../../../src/hooks/useDirtyPositions';

const originals = {
  a: { lat: 53.1, lng: 9.1 },
  b: { lat: 53.2, lng: 9.2 },
};

describe('useDirtyPositions', () => {
  it('starts with zero dirty entries', () => {
    const { result } = renderHook(() => useDirtyPositions(originals));
    expect(result.current.dirtyCount).toBe(0);
    expect(result.current.isDirty('a')).toBe(false);
    expect([...result.current.dirtyIds]).toEqual([]);
  });

  it('set() marks the id dirty and returns the new coords', () => {
    const { result } = renderHook(() => useDirtyPositions(originals));
    act(() => result.current.set('a', { lat: 53.99, lng: 9.99 }));
    expect(result.current.isDirty('a')).toBe(true);
    expect(result.current.dirtyCount).toBe(1);
    expect(result.current.getCoords('a')).toEqual({ lat: 53.99, lng: 9.99 });
    // Other ids unaffected.
    expect(result.current.isDirty('b')).toBe(false);
    expect(result.current.getCoords('b')).toEqual(originals.b);
  });

  it('set() to coords matching the original (within 1e-9) drops the entry', () => {
    const { result } = renderHook(() => useDirtyPositions(originals));
    act(() => result.current.set('a', { lat: 53.99, lng: 9.99 }));
    expect(result.current.isDirty('a')).toBe(true);
    act(() =>
      result.current.set('a', {
        lat: 53.1 + 1e-10,
        lng: 9.1 - 1e-10,
      }),
    );
    expect(result.current.isDirty('a')).toBe(false);
    expect(result.current.dirtyCount).toBe(0);
  });

  it('getCoords() returns originals for ids never edited', () => {
    const { result } = renderHook(() => useDirtyPositions(originals));
    expect(result.current.getCoords('b')).toEqual({ lat: 53.2, lng: 9.2 });
  });

  it('revert(id) removes a single entry, leaving other dirty entries', () => {
    const { result } = renderHook(() => useDirtyPositions(originals));
    act(() => {
      result.current.set('a', { lat: 1, lng: 2 });
      result.current.set('b', { lat: 3, lng: 4 });
    });
    expect(result.current.dirtyCount).toBe(2);
    act(() => result.current.revert('a'));
    expect(result.current.isDirty('a')).toBe(false);
    expect(result.current.isDirty('b')).toBe(true);
    expect(result.current.getCoords('a')).toEqual(originals.a);
  });

  it('revertAll() clears every entry', () => {
    const { result } = renderHook(() => useDirtyPositions(originals));
    act(() => {
      result.current.set('a', { lat: 1, lng: 2 });
      result.current.set('b', { lat: 3, lng: 4 });
    });
    act(() => result.current.revertAll());
    expect(result.current.dirtyCount).toBe(0);
    expect(result.current.isDirty('a')).toBe(false);
    expect(result.current.isDirty('b')).toBe(false);
  });

  it('commit(ids) drops only the listed ids; other dirty entries remain', () => {
    const { result } = renderHook(() => useDirtyPositions(originals));
    act(() => {
      result.current.set('a', { lat: 1, lng: 2 });
      result.current.set('b', { lat: 3, lng: 4 });
    });
    act(() => result.current.commit(['a']));
    expect(result.current.isDirty('a')).toBe(false);
    expect(result.current.isDirty('b')).toBe(true);
    expect(result.current.dirtyCount).toBe(1);
  });
});
```

- [ ] **Step 2.2: Run the test to verify it fails**

```bash
pnpm test:run tests/unit/hooks/useDirtyPositions.test.ts
```

Expected: FAIL — module `src/hooks/useDirtyPositions` not found.

- [ ] **Step 2.3: Implement the hook**

Create `src/hooks/useDirtyPositions.ts`:

```ts
import { useCallback, useMemo, useState } from 'react';

export interface Coords {
  lat: number;
  lng: number;
}

type DirtyMap = Record<string, Coords>;

const EPSILON = 1e-9;

function nearlyEqual(a: Coords, b: Coords): boolean {
  return Math.abs(a.lat - b.lat) < EPSILON && Math.abs(a.lng - b.lng) < EPSILON;
}

export interface UseDirtyPositionsApi {
  isDirty: (id: string) => boolean;
  dirtyIds: Set<string>;
  dirtyCount: number;
  getCoords: (id: string) => Coords | undefined;
  set: (id: string, coords: Coords) => void;
  revert: (id: string) => void;
  revertAll: () => void;
  /** Drop the given ids from edits. Use after a successful save. */
  commit: (ids: string[]) => void;
}

/**
 * Tracks per-tent staged coordinate edits against an immutable `originals`
 * snapshot. `set()` to coords that match the original (within 1e-9) drops the
 * entry — so revert-by-dragging-back works automatically.
 *
 * The hook does NOT auto-reset when `originals` changes. The caller owns the
 * lifecycle and must call `commit(ids)` after a successful save.
 */
export function useDirtyPositions(
  originals: Record<string, Coords>,
): UseDirtyPositionsApi {
  const [edits, setEdits] = useState<DirtyMap>({});

  const set = useCallback(
    (id: string, coords: Coords) => {
      setEdits((prev) => {
        const original = originals[id];
        if (original && nearlyEqual(coords, original)) {
          if (!(id in prev)) return prev;
          const { [id]: _drop, ...rest } = prev;
          return rest;
        }
        return { ...prev, [id]: coords };
      });
    },
    [originals],
  );

  const revert = useCallback((id: string) => {
    setEdits((prev) => {
      if (!(id in prev)) return prev;
      const { [id]: _drop, ...rest } = prev;
      return rest;
    });
  }, []);

  const revertAll = useCallback(() => setEdits({}), []);

  const commit = useCallback((ids: string[]) => {
    setEdits((prev) => {
      const next = { ...prev };
      for (const id of ids) delete next[id];
      return next;
    });
  }, []);

  const dirtyIds = useMemo(() => new Set(Object.keys(edits)), [edits]);

  return {
    isDirty: (id) => id in edits,
    dirtyIds,
    dirtyCount: dirtyIds.size,
    getCoords: (id) => edits[id] ?? originals[id],
    set,
    revert,
    revertAll,
    commit,
  };
}
```

- [ ] **Step 2.4: Run the test to verify it passes**

```bash
pnpm test:run tests/unit/hooks/useDirtyPositions.test.ts
```

Expected: PASS — all 7 tests green.

- [ ] **Step 2.5: Commit**

```bash
git add src/hooks/useDirtyPositions.ts tests/unit/hooks/useDirtyPositions.test.ts
git commit -m "feat(hooks): add useDirtyPositions for staged tent-coord edits"
```

---

## Task 3 — `PositionsTentList` component

**Files:**
- Create: `src/components/PositionsTentList.tsx`
- Create: `tests/unit/components/PositionsTentList.test.tsx`

Stateless presentational component. Receives the split tent arrays + dirty info + the selected id, fires `onSelect` / `onRevert`. Used by `PositionsPage`.

- [ ] **Step 3.1: Write the failing tests**

Create `tests/unit/components/PositionsTentList.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../src/lib/i18n';
import {
  PositionsTentList,
  type PositionsTentListItem,
} from '../../../src/components/PositionsTentList';

function placed(
  id: string,
  name: string,
  num: number | null = null,
): PositionsTentListItem {
  return { id, name, display_number: num };
}

function renderList(props: Partial<React.ComponentProps<typeof PositionsTentList>> = {}) {
  const defaults: React.ComponentProps<typeof PositionsTentList> = {
    placed: [placed('a', 'Alpha', 1), placed('b', 'Bravo', 2)],
    unplaced: [placed('c', 'Charlie', null)],
    dirtyIds: new Set<string>(),
    selectedId: null,
    canEdit: true,
    onSelect: vi.fn(),
    onRevert: vi.fn(),
  };
  return render(
    <I18nextProvider i18n={i18n}>
      <PositionsTentList {...defaults} {...props} />
    </I18nextProvider>,
  );
}

describe('PositionsTentList', () => {
  it('renders both Placed and Unplaced section headers with counts', () => {
    renderList();
    expect(
      screen.getByText(/placed \(2\)|platziert \(2\)/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/not placed \(1\)|nicht platziert \(1\)/i),
    ).toBeInTheDocument();
  });

  it('renders placed rows with #number and name', () => {
    renderList();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Bravo')).toBeInTheDocument();
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
  });

  it('hides the Unplaced section entirely when there are zero unplaced tents', () => {
    renderList({ unplaced: [] });
    expect(screen.queryByText(/not placed|nicht platziert/i)).toBeNull();
  });

  it('shows the empty message when there are zero placed tents', () => {
    renderList({ placed: [] });
    expect(
      screen.getByText(/no tents placed yet|noch keine stände platziert/i),
    ).toBeInTheDocument();
  });

  it('clicking a placed row fires onSelect with the id', async () => {
    const onSelect = vi.fn();
    renderList({ onSelect });
    await userEvent.click(screen.getByRole('button', { name: /alpha/i }));
    expect(onSelect).toHaveBeenCalledWith('a');
  });

  it('renders a revert button only for dirty rows; clicking it fires onRevert and NOT onSelect', async () => {
    const onSelect = vi.fn();
    const onRevert = vi.fn();
    renderList({ dirtyIds: new Set(['a']), onSelect, onRevert });

    // Only one revert button exists (Alpha is dirty, Bravo is not).
    const revertBtns = screen.getAllByRole('button', { name: /revert|zurücksetzen/i });
    expect(revertBtns).toHaveLength(1);

    await userEvent.click(revertBtns[0]!);
    expect(onRevert).toHaveBeenCalledWith('a');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('canEdit=false hides revert buttons even on dirty rows', () => {
    renderList({ dirtyIds: new Set(['a', 'b']), canEdit: false });
    expect(
      screen.queryAllByRole('button', { name: /revert|zurücksetzen/i }),
    ).toHaveLength(0);
  });

  it('selectedId highlights the corresponding row', () => {
    renderList({ selectedId: 'b' });
    const row = screen.getByRole('button', { name: /bravo/i });
    // The selected row gets aria-current="true".
    expect(row).toHaveAttribute('aria-current', 'true');
  });

  it('unplaced rows are not interactive (no onSelect)', async () => {
    const onSelect = vi.fn();
    renderList({ onSelect });
    // Charlie is unplaced. It must NOT render as a button.
    expect(screen.queryByRole('button', { name: /charlie/i })).toBeNull();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });
});

// Silence the unused-import warning if `within` ends up unused.
void within;
```

- [ ] **Step 3.2: Run the test to verify it fails**

```bash
pnpm test:run tests/unit/components/PositionsTentList.test.tsx
```

Expected: FAIL — module `src/components/PositionsTentList` not found.

- [ ] **Step 3.3: Implement the component**

Create `src/components/PositionsTentList.tsx`:

```tsx
import { useTranslation } from 'react-i18next';

export interface PositionsTentListItem {
  id: string;
  name: string;
  display_number: number | null;
}

interface Props {
  placed: PositionsTentListItem[];
  unplaced: PositionsTentListItem[];
  dirtyIds: Set<string>;
  selectedId: string | null;
  canEdit: boolean;
  onSelect: (id: string) => void;
  onRevert: (id: string) => void;
}

export function PositionsTentList({
  placed,
  unplaced,
  dirtyIds,
  selectedId,
  canEdit,
  onSelect,
  onRevert,
}: Props) {
  const { t } = useTranslation();

  return (
    <aside
      aria-label={t('admin.positions.placed_heading', { count: placed.length })}
      className="flex h-full w-56 shrink-0 flex-col overflow-y-auto border-r border-white/10 bg-neutral-900/40 text-sm"
    >
      <section className="p-3">
        <h2 className="mb-2 text-xs uppercase tracking-wide text-white/60">
          {t('admin.positions.placed_heading', { count: placed.length })}
        </h2>
        {placed.length === 0 ? (
          <p className="text-xs text-white/50">
            {t('admin.positions.placed_empty')}
          </p>
        ) : (
          <ul className="space-y-1">
            {placed.map((tent) => {
              const isDirty = dirtyIds.has(tent.id);
              const isSelected = selectedId === tent.id;
              return (
                <li key={tent.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onSelect(tent.id)}
                    aria-current={isSelected ? 'true' : undefined}
                    className={`flex flex-1 items-center gap-2 rounded px-2 py-1 text-left hover:bg-white/10 ${
                      isSelected ? 'bg-white/15 ring-1 ring-white/30' : ''
                    } ${isDirty ? 'text-yellow-300' : ''}`}
                  >
                    {tent.display_number != null && (
                      <span className="font-mono text-xs text-white/60">
                        #{tent.display_number}
                      </span>
                    )}
                    <span className="flex-1 truncate">{tent.name}</span>
                  </button>
                  {canEdit && isDirty && (
                    <button
                      type="button"
                      onClick={() => onRevert(tent.id)}
                      aria-label={t('admin.positions.revert_aria', { name: tent.name })}
                      className="rounded px-2 py-1 text-xs text-white/60 hover:bg-white/10 hover:text-white"
                    >
                      ↺
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {unplaced.length > 0 && (
        <section className="border-t border-white/10 p-3">
          <h2 className="mb-2 text-xs uppercase tracking-wide text-white/60">
            {t('admin.positions.unplaced_heading', { count: unplaced.length })}
          </h2>
          <ul className="space-y-1">
            {unplaced.map((tent) => (
              <li key={tent.id} className="px-2 py-1 text-white/50">
                {tent.name}
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
```

- [ ] **Step 3.4: Run the test to verify it passes**

```bash
pnpm test:run tests/unit/components/PositionsTentList.test.tsx
```

Expected: PASS — all 9 tests green.

- [ ] **Step 3.5: Commit**

```bash
git add src/components/PositionsTentList.tsx tests/unit/components/PositionsTentList.test.tsx
git commit -m "feat(positions): add PositionsTentList side-rail component"
```

---

## Task 4 — `PositionsMap` component

**Files:**
- Create: `src/components/PositionsMap.tsx`
- Create: `tests/unit/components/PositionsMap.test.tsx`

Leaflet map with one draggable marker per placed tent. Drag fires `onPositionChange(id, lat, lng)`. Dirty markers use a yellow-ring icon with always-visible number label. `focusTentId` change → `map.flyTo`. Click on blank map: no-op (no click-to-place).

This component reuses the existing `react-leaflet` mock pattern from `MapView.test.tsx`. The mock exposes the drag handler via the `eventHandlers` prop and routes `useMap()` to a shared `__mockMap` that records `flyTo` calls.

- [ ] **Step 4.1: Write the failing tests**

Create `tests/unit/components/PositionsMap.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { PositionsMap, type PositionsMapTent } from '../../../src/components/PositionsMap';

interface MockMap {
  flyTo: ReturnType<typeof vi.fn>;
  getZoom: ReturnType<typeof vi.fn>;
}

function makeMockMap(): MockMap {
  return {
    flyTo: vi.fn(),
    getZoom: vi.fn(() => 18),
  };
}

// Shared map instance for useMap()-based components in the test.
const g = globalThis as unknown as {
  __mockMap?: MockMap;
  __markerDragHandlers?: Record<string, (latlng: { lat: number; lng: number }) => void>;
};

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
    <div data-testid="map" data-center={JSON.stringify(center)} data-zoom={zoom}>
      {children}
    </div>
  ),
  TileLayer: ({ url }: { url?: string }) => (
    <div data-testid="tile-layer" data-url={url ?? ''} />
  ),
  ZoomControl: () => <div data-testid="zoom-control" />,
  Marker: ({
    position,
    icon,
    draggable,
    title,
    eventHandlers,
  }: {
    position: [number, number];
    icon?: { options?: { html?: string } };
    draggable?: boolean;
    title?: string;
    eventHandlers?: { dragend?: (e: { target: { getLatLng: () => { lat: number; lng: number } } }) => void };
  }) => {
    // Surface dirty styling: PositionsMap encodes "dirty" by including the
    // class `marker-dirty` in the icon HTML. Tests assert on data-dirty.
    const html = icon?.options?.html ?? '';
    const isDirty = html.includes('marker-dirty');
    // Register a drag handler keyed by stringified position so tests can
    // synthesize a dragend.
    if (eventHandlers?.dragend) {
      g.__markerDragHandlers = g.__markerDragHandlers ?? {};
      g.__markerDragHandlers[title ?? ''] = (latlng) =>
        eventHandlers.dragend!({
          target: { getLatLng: () => latlng },
        });
    }
    return (
      <div
        data-testid="marker"
        data-position={JSON.stringify(position)}
        data-draggable={draggable ? 'true' : 'false'}
        data-dirty={isDirty ? 'true' : 'false'}
        data-title={title ?? ''}
      />
    );
  },
  useMap: () => {
    if (!g.__mockMap) g.__mockMap = makeMockMap();
    return g.__mockMap;
  },
  useMapEvents: () => ({
    getZoom: () => 18,
  }),
}));

vi.mock('leaflet', () => ({
  default: {
    divIcon: (opts: { html?: string }) => ({ options: opts }),
    latLng: (lat: number, lng: number) => ({ lat, lng }),
  },
}));

vi.mock('leaflet/dist/leaflet.css', () => ({}));

// MapStyleToggle uses i18n; mock minimally to keep this test focused.
vi.mock('../../../src/components/MapStyleToggle', () => ({
  MapStyleToggle: () => <div data-testid="style-toggle" />,
}));

const SAMPLE: PositionsMapTent[] = [
  { id: 'a', name: 'Alpha', display_number: 1, lat: 53.1, lng: 9.1 },
  { id: 'b', name: 'Bravo', display_number: 2, lat: 53.2, lng: 9.2 },
];

beforeEach(() => {
  g.__mockMap = makeMockMap();
  g.__markerDragHandlers = {};
});

describe('PositionsMap', () => {
  function renderMap(
    overrides: Partial<React.ComponentProps<typeof PositionsMap>> = {},
  ) {
    const defaults: React.ComponentProps<typeof PositionsMap> = {
      tents: SAMPLE,
      dirtyIds: new Set<string>(),
      focusTentId: null,
      canEdit: true,
      tileStyle: 'osm',
      onTileStyleChange: vi.fn(),
      onPositionChange: vi.fn(),
      defaultCenter: [53.0, 9.0],
      defaultZoom: 18,
    };
    return render(<PositionsMap {...defaults} {...overrides} />);
  }

  it('renders one marker per placed tent', () => {
    const { getAllByTestId } = renderMap();
    expect(getAllByTestId('marker')).toHaveLength(2);
  });

  it('markers are draggable when canEdit=true', () => {
    const { getAllByTestId } = renderMap();
    for (const m of getAllByTestId('marker')) {
      expect(m).toHaveAttribute('data-draggable', 'true');
    }
  });

  it('markers are NOT draggable when canEdit=false', () => {
    const { getAllByTestId } = renderMap({ canEdit: false });
    for (const m of getAllByTestId('marker')) {
      expect(m).toHaveAttribute('data-draggable', 'false');
    }
  });

  it('dirty marker carries data-dirty="true"', () => {
    const { getAllByTestId } = renderMap({ dirtyIds: new Set(['a']) });
    const markers = getAllByTestId('marker');
    const alpha = markers.find((m) => m.getAttribute('data-title') === 'Alpha');
    const bravo = markers.find((m) => m.getAttribute('data-title') === 'Bravo');
    expect(alpha).toHaveAttribute('data-dirty', 'true');
    expect(bravo).toHaveAttribute('data-dirty', 'false');
  });

  it('marker dragend fires onPositionChange(id, lat, lng)', () => {
    const onPositionChange = vi.fn();
    renderMap({ onPositionChange });
    // Synthesize a drag on Alpha via the captured handler.
    g.__markerDragHandlers!.Alpha!({ lat: 53.55, lng: 9.55 });
    expect(onPositionChange).toHaveBeenCalledWith('a', 53.55, 9.55);
  });

  it('focusTentId change triggers map.flyTo on the focused tent', () => {
    const { rerender } = renderMap();
    // Initially focusTentId=null → no flyTo.
    expect(g.__mockMap!.flyTo).not.toHaveBeenCalled();
    rerender(
      <PositionsMap
        tents={SAMPLE}
        dirtyIds={new Set()}
        focusTentId="b"
        canEdit={true}
        tileStyle="osm"
        onTileStyleChange={vi.fn()}
        onPositionChange={vi.fn()}
        defaultCenter={[53, 9]}
        defaultZoom={18}
      />,
    );
    expect(g.__mockMap!.flyTo).toHaveBeenCalledTimes(1);
    const [latlng] = g.__mockMap!.flyTo.mock.calls[0]!;
    expect(latlng).toEqual({ lat: 53.2, lng: 9.2 });
  });
});
```

- [ ] **Step 4.2: Run the test to verify it fails**

```bash
pnpm test:run tests/unit/components/PositionsMap.test.tsx
```

Expected: FAIL — module `src/components/PositionsMap` not found.

- [ ] **Step 4.3: Implement the component**

Create `src/components/PositionsMap.tsx`:

```tsx
import { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TENT_FOCUS_ZOOM, TILE_CONFIGS, type TileStyle } from '../lib/map';
import { MapStyleToggle } from './MapStyleToggle';

export interface PositionsMapTent {
  id: string;
  name: string;
  display_number: number | null;
  lat: number;
  lng: number;
}

interface Props {
  tents: PositionsMapTent[];
  dirtyIds: Set<string>;
  focusTentId: string | null;
  canEdit: boolean;
  tileStyle: TileStyle;
  onTileStyleChange: (next: TileStyle) => void;
  onPositionChange: (id: string, lat: number, lng: number) => void;
  defaultCenter: [number, number];
  defaultZoom: number;
}

function FocusController({
  tents,
  focusTentId,
}: {
  tents: PositionsMapTent[];
  focusTentId: string | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (!focusTentId) return;
    const tent = tents.find((t) => t.id === focusTentId);
    if (!tent) return;
    map.flyTo({ lat: tent.lat, lng: tent.lng }, TENT_FOCUS_ZOOM, {
      animate: true,
      duration: 0.6,
    });
  }, [focusTentId, tents, map]);
  return null;
}

function tentIcon(tent: PositionsMapTent, dirty: boolean): L.DivIcon {
  const label = tent.display_number != null ? String(tent.display_number) : '';
  const ring = dirty
    ? 'box-shadow:0 0 0 3px #facc15,0 1px 3px rgba(0,0,0,0.4);'
    : 'box-shadow:0 1px 3px rgba(0,0,0,0.4);';
  const bg = dirty ? '#facc15' : '#22c55e';
  const fg = dirty ? '#422006' : '#052e16';
  const cls = dirty ? 'marker-dirty' : 'marker-clean';
  return L.divIcon({
    html: `<div class="${cls}" style="height:24px;width:24px;border-radius:9999px;background:${bg};border:2px solid white;${ring}display:flex;align-items:center;justify-content:center;color:${fg};font-size:10px;font-weight:600;">${label}</div>`,
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

export function PositionsMap({
  tents,
  dirtyIds,
  focusTentId,
  canEdit,
  tileStyle,
  onTileStyleChange,
  onPositionChange,
  defaultCenter,
  defaultZoom,
}: Props) {
  return (
    <div className="h-full w-full overflow-hidden">
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        maxZoom={22}
        zoomControl={false}
        className="h-full w-full"
      >
        <ZoomControl position="bottomleft" />
        <MapStyleToggle value={tileStyle} onChange={onTileStyleChange} />
        <TileLayer
          key={tileStyle}
          attribution={TILE_CONFIGS[tileStyle].attribution}
          url={TILE_CONFIGS[tileStyle].url}
          maxNativeZoom={TILE_CONFIGS[tileStyle].maxNativeZoom}
          maxZoom={22}
        />
        <FocusController tents={tents} focusTentId={focusTentId} />
        {tents.map((tent) => {
          const dirty = dirtyIds.has(tent.id);
          return (
            <Marker
              key={tent.id}
              position={[tent.lat, tent.lng]}
              icon={tentIcon(tent, dirty)}
              draggable={canEdit}
              title={tent.name}
              eventHandlers={{
                dragend: (e: {
                  target: { getLatLng: () => { lat: number; lng: number } };
                }) => {
                  const p = e.target.getLatLng();
                  onPositionChange(tent.id, p.lat, p.lng);
                },
              }}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}
```

- [ ] **Step 4.4: Run the test to verify it passes**

```bash
pnpm test:run tests/unit/components/PositionsMap.test.tsx
```

Expected: PASS — all 6 tests green.

- [ ] **Step 4.5: Commit**

```bash
git add src/components/PositionsMap.tsx tests/unit/components/PositionsMap.test.tsx
git commit -m "feat(positions): add PositionsMap leaflet view with draggable tent markers"
```

---

## Task 5 — `PositionsPage` page

**Files:**
- Create: `src/pages/admin/PositionsPage.tsx`
- Create: `tests/unit/pages/PositionsPage.test.tsx`

Composes everything: loads `event` + `tents`, splits placed/unplaced, owns dirty state, renders mobile gate or side-list+map+footer, handles save and discard, blocks navigation when dirty.

- [ ] **Step 5.1: Write the failing tests**

Create `tests/unit/pages/PositionsPage.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '../../../src/lib/i18n';

// Shared supabase mock — overridden per test for update behavior.
const supabaseUpdate = vi.fn();
const supabaseEq = vi.fn();

vi.mock('../../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: (payload: unknown) => {
        supabaseUpdate(payload);
        return {
          eq: (col: string, val: string) => {
            supabaseEq(col, val);
            return supabaseEq.mock.results[supabaseEq.mock.calls.length - 1]?.value
              ?? Promise.resolve({ data: null, error: null });
          },
        };
      },
    })),
  },
}));

// Use real hooks but stub their data via module mocks.
vi.mock('../../../src/hooks/useEvent', () => ({
  useEvent: () => ({
    event: {
      id: 'evt-1',
      slug: 'evt-1',
      title_de: 'Test',
      default_lat: 53.27,
      default_lng: 9.5,
      default_zoom: 18,
    },
    loading: false,
    error: null,
  }),
}));

const tentsState = {
  current: [
    { id: 'a', name: 'Alpha', display_number: 1, lat: 53.1, lng: 9.1, categories: [] },
    { id: 'b', name: 'Bravo', display_number: 2, lat: 53.2, lng: 9.2, categories: [] },
    { id: 'c', name: 'Charlie', display_number: 3, lat: null, lng: null, categories: [] },
  ],
};

vi.mock('../../../src/hooks/useTents', () => ({
  useTents: () => ({ tents: tentsState.current, loading: false, error: null }),
}));

vi.mock('../../../src/hooks/useEventPermissions', () => ({
  useEventPermissions: () => ({
    loading: false,
    canAccess: true,
    canContribute: true,
    canEdit: true,
    canOwn: false,
  }),
}));

vi.mock('../../../src/hooks/useTileStyle', () => ({
  useTileStyle: () => ['osm', vi.fn()],
}));

// PositionsMap brings in leaflet; replace with a minimal stub that exposes the
// drag handler and dirty flag via the DOM. The page test only cares about the
// page logic.
vi.mock('../../../src/components/PositionsMap', () => {
  return {
    PositionsMap: ({
      tents,
      dirtyIds,
      onPositionChange,
    }: {
      tents: Array<{ id: string; name: string; lat: number; lng: number }>;
      dirtyIds: Set<string>;
      onPositionChange: (id: string, lat: number, lng: number) => void;
    }) => (
      <div data-testid="positions-map">
        {tents.map((t) => (
          <button
            key={t.id}
            data-testid={`drag-${t.id}`}
            data-dirty={dirtyIds.has(t.id) ? 'true' : 'false'}
            onClick={() => onPositionChange(t.id, t.lat + 0.001, t.lng + 0.001)}
          >
            drag {t.name}
          </button>
        ))}
      </div>
    ),
  };
});

// ToastProvider context — give the page a real provider.
import { ToastProvider } from '../../../src/components/ToastProvider';
import PositionsPage from '../../../src/pages/admin/PositionsPage';

beforeEach(() => {
  supabaseUpdate.mockClear();
  supabaseEq.mockClear();
  // Default each update().eq() resolves OK.
  supabaseEq.mockImplementation(() => Promise.resolve({ data: null, error: null }));
});

afterEach(() => {
  vi.clearAllMocks();
});

function renderPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/admin/events/evt-1/positions']}>
          <Routes>
            <Route
              path="/admin/events/:eventSlug/positions"
              element={<PositionsPage />}
            />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </I18nextProvider>,
  );
}

describe('PositionsPage', () => {
  it('renders the side list with placed + unplaced sections', () => {
    renderPage();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Bravo')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });

  it('save button is disabled when no edits exist', () => {
    renderPage();
    const btn = screen.getByRole('button', {
      name: /save changes \(0\)|änderungen speichern \(0\)/i,
    });
    expect(btn).toBeDisabled();
  });

  it('dragging a marker enables the save button and increments the dirty count', async () => {
    renderPage();
    await userEvent.click(screen.getByTestId('drag-a'));
    const btn = screen.getByRole('button', {
      name: /save changes \(1\)|änderungen speichern \(1\)/i,
    });
    expect(btn).toBeEnabled();
  });

  it('save fires one supabase update().eq() per dirty tent with the new coords', async () => {
    renderPage();
    await userEvent.click(screen.getByTestId('drag-a'));
    await userEvent.click(screen.getByTestId('drag-b'));
    const btn = screen.getByRole('button', {
      name: /save changes \(2\)|änderungen speichern \(2\)/i,
    });
    await userEvent.click(btn);
    await waitFor(() => {
      expect(supabaseUpdate).toHaveBeenCalledTimes(2);
      expect(supabaseEq).toHaveBeenCalledTimes(2);
    });
    // Verify each update payload carries {lat, lng}.
    const payloads = supabaseUpdate.mock.calls.map((c) => c[0]);
    for (const p of payloads) {
      expect(p).toHaveProperty('lat');
      expect(p).toHaveProperty('lng');
    }
  });

  it('save success clears dirty state and shows a success toast', async () => {
    renderPage();
    await userEvent.click(screen.getByTestId('drag-a'));
    await userEvent.click(
      screen.getByRole('button', {
        name: /save changes \(1\)|änderungen speichern \(1\)/i,
      }),
    );
    await waitFor(() => {
      expect(
        screen.getByText(/1 positions saved|1 positionen gespeichert/i),
      ).toBeInTheDocument();
    });
    const btnAfter = screen.getByRole('button', {
      name: /save changes \(0\)|änderungen speichern \(0\)/i,
    });
    expect(btnAfter).toBeDisabled();
  });

  it('save partial failure: failed tent stays dirty, error toast shows partial summary', async () => {
    // Make Alpha fail, Bravo succeed. The mock keys by call order.
    let callIdx = 0;
    supabaseEq.mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) {
        return Promise.resolve({ data: null, error: { message: 'boom' } });
      }
      return Promise.resolve({ data: null, error: null });
    });
    renderPage();
    await userEvent.click(screen.getByTestId('drag-a'));
    await userEvent.click(screen.getByTestId('drag-b'));
    await userEvent.click(
      screen.getByRole('button', {
        name: /save changes \(2\)|änderungen speichern \(2\)/i,
      }),
    );
    await waitFor(() => {
      // 1 of 2 saved, 1 failed.
      expect(
        screen.getByText(
          /1 of 2 saved\. 1 failed: boom|1 von 2 gespeichert\. 1 fehlgeschlagen: boom/i,
        ),
      ).toBeInTheDocument();
    });
    // One tent stays dirty after partial failure.
    const btnAfter = screen.getByRole('button', {
      name: /save changes \(1\)|änderungen speichern \(1\)/i,
    });
    expect(btnAfter).toBeEnabled();
  });

  it('discard-all opens confirm and clears every edit on confirm', async () => {
    renderPage();
    await userEvent.click(screen.getByTestId('drag-a'));
    await userEvent.click(screen.getByTestId('drag-b'));
    await userEvent.click(
      screen.getByRole('button', { name: /discard all|alle verwerfen/i }),
    );
    // Modal "Discard"/"Verwerfen" submit button.
    await userEvent.click(
      screen.getByRole('button', { name: /^discard$|^verwerfen$/i }),
    );
    const btn = screen.getByRole('button', {
      name: /save changes \(0\)|änderungen speichern \(0\)/i,
    });
    expect(btn).toBeDisabled();
  });
});
```

- [ ] **Step 5.2: Run the test to verify it fails**

```bash
pnpm test:run tests/unit/pages/PositionsPage.test.tsx
```

Expected: FAIL — module `src/pages/admin/PositionsPage` not found.

- [ ] **Step 5.3: Implement the page**

Create `src/pages/admin/PositionsPage.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useEvent } from '../../hooks/useEvent';
import { useTents } from '../../hooks/useTents';
import { useEventPermissions } from '../../hooks/useEventPermissions';
import { useTileStyle } from '../../hooks/useTileStyle';
import { useDirtyPositions, type Coords } from '../../hooks/useDirtyPositions';
import { useToast } from '../../components/ToastProvider';
import { PositionsMap, type PositionsMapTent } from '../../components/PositionsMap';
import {
  PositionsTentList,
  type PositionsTentListItem,
} from '../../components/PositionsTentList';

const MOBILE_QUERY = '(max-width: 767.98px)';

export default function PositionsPage() {
  const { t } = useTranslation();
  const { eventSlug } = useParams();
  const { event } = useEvent(eventSlug);
  const { tents } = useTents(event?.id);
  const { canEdit } = useEventPermissions(event?.id);
  const [tileStyle, setTileStyle] = useTileStyle();
  const { showSuccess, showError } = useToast();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Track viewport — mobile gate hides the editor below md.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(MOBILE_QUERY);
    setIsMobile(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const placedTents: PositionsMapTent[] = useMemo(
    () =>
      tents
        .filter(
          (tent): tent is typeof tent & { lat: number; lng: number } =>
            tent.lat != null && tent.lng != null,
        )
        .map((tent) => ({
          id: tent.id,
          name: tent.name,
          display_number: tent.display_number,
          lat: tent.lat,
          lng: tent.lng,
        })),
    [tents],
  );

  const unplacedListItems: PositionsTentListItem[] = useMemo(
    () =>
      tents
        .filter((tent) => tent.lat == null || tent.lng == null)
        .map((tent) => ({
          id: tent.id,
          name: tent.name,
          display_number: tent.display_number,
        })),
    [tents],
  );

  const placedListItems: PositionsTentListItem[] = useMemo(
    () =>
      placedTents.map((tent) => ({
        id: tent.id,
        name: tent.name,
        display_number: tent.display_number,
      })),
    [placedTents],
  );

  const originals: Record<string, Coords> = useMemo(() => {
    const out: Record<string, Coords> = {};
    for (const tent of placedTents) {
      out[tent.id] = { lat: tent.lat, lng: tent.lng };
    }
    return out;
  }, [placedTents]);

  const dirty = useDirtyPositions(originals);

  // Apply staged edits over the original positions for the map.
  const renderedTents: PositionsMapTent[] = useMemo(
    () =>
      placedTents.map((tent) => {
        const coords = dirty.getCoords(tent.id) ?? tent;
        return { ...tent, lat: coords.lat, lng: coords.lng };
      }),
    [placedTents, dirty],
  );

  // Browser-level "you have unsaved changes" guard.
  useEffect(() => {
    if (dirty.dirtyCount === 0) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty.dirtyCount]);

  if (!event) return null;

  if (isMobile) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <h1 className="mb-2 text-xl font-semibold">
          {t('admin.positions.mobile_gate_title')}
        </h1>
        <p className="mb-4 text-sm text-white/70">
          {t('admin.positions.mobile_gate_body')}
        </p>
        <Link
          to={`/admin/events/${event.slug}/tents`}
          className="rounded bg-white/20 px-3 py-1 text-sm"
        >
          {t('admin.positions.mobile_gate_link')}
        </Link>
      </div>
    );
  }

  async function onSave() {
    const ids = [...dirty.dirtyIds];
    if (ids.length === 0) return;
    setSaving(true);
    try {
      const results = await Promise.allSettled(
        ids.map((id) => {
          const coords = dirty.getCoords(id);
          if (!coords) return Promise.resolve();
          return supabase
            .from('tents')
            .update({ lat: coords.lat, lng: coords.lng })
            .eq('id', id)
            .then((r: { error: { message: string } | null }) => {
              if (r.error) throw new Error(r.error.message);
            });
        }),
      );
      const okIds: string[] = [];
      const failures: string[] = [];
      results.forEach((r, idx) => {
        const id = ids[idx]!;
        if (r.status === 'fulfilled') okIds.push(id);
        else failures.push((r.reason as Error).message ?? 'error');
      });
      dirty.commit(okIds);
      if (failures.length === 0) {
        showSuccess(t('admin.positions.save_success', { count: okIds.length }));
      } else {
        showError(
          t('admin.positions.save_partial_error', {
            ok: okIds.length,
            total: ids.length,
            failed: failures.length,
            message: failures[0] ?? '',
          }),
        );
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <h1 className="mb-2 text-xl font-semibold">
        {t('admin.positions.heading', { title: event.title_de })}
      </h1>
      <div className="flex flex-1 overflow-hidden rounded border border-white/10">
        <PositionsTentList
          placed={placedListItems}
          unplaced={unplacedListItems}
          dirtyIds={dirty.dirtyIds}
          selectedId={selectedId}
          canEdit={canEdit}
          onSelect={setSelectedId}
          onRevert={dirty.revert}
        />
        <div className="flex-1">
          <PositionsMap
            tents={renderedTents}
            dirtyIds={dirty.dirtyIds}
            focusTentId={selectedId}
            canEdit={canEdit}
            tileStyle={tileStyle}
            onTileStyleChange={setTileStyle}
            onPositionChange={(id, lat, lng) => dirty.set(id, { lat, lng })}
            defaultCenter={[event.default_lat, event.default_lng]}
            defaultZoom={event.default_zoom}
          />
        </div>
      </div>
      {canEdit && (
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={onSave}
            disabled={dirty.dirtyCount === 0 || saving}
            className="rounded bg-emerald-500/80 px-3 py-1 text-sm font-medium disabled:opacity-40"
          >
            {saving
              ? t('admin.positions.saving')
              : t('admin.positions.save_button', { count: dirty.dirtyCount })}
          </button>
          {dirty.dirtyCount > 0 && (
            <button
              type="button"
              onClick={() => setConfirmDiscard(true)}
              className="rounded bg-white/10 px-3 py-1 text-sm hover:bg-white/20"
            >
              {t('admin.positions.discard_button')}
            </button>
          )}
        </div>
      )}

      {confirmDiscard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div
            role="dialog"
            aria-labelledby="discard-h"
            className="w-full max-w-sm rounded bg-neutral-900 p-4 text-white"
          >
            <h2 id="discard-h" className="mb-2 text-base font-semibold">
              {t('admin.positions.discard_confirm_heading', {
                count: dirty.dirtyCount,
              })}
            </h2>
            <p className="mb-4 text-sm text-white/70">
              {t('admin.positions.discard_confirm_body')}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDiscard(false)}
                className="rounded bg-white/10 px-3 py-1 text-sm"
              >
                {t('admin.positions.discard_confirm_cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  dirty.revertAll();
                  setConfirmDiscard(false);
                }}
                className="rounded bg-red-500/80 px-3 py-1 text-sm font-medium"
              >
                {t('admin.positions.discard_confirm_submit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5.4: Run the test to verify it passes**

```bash
pnpm test:run tests/unit/pages/PositionsPage.test.tsx
```

Expected: PASS — all 7 tests green.

- [ ] **Step 5.5: Commit**

```bash
git add src/pages/admin/PositionsPage.tsx tests/unit/pages/PositionsPage.test.tsx
git commit -m "feat(positions): add PositionsPage with stage+save and mobile gate"
```

---

## Task 6 — Route + EventListPage link

**Files:**
- Modify: `src/routes.tsx`
- Modify: `src/pages/admin/EventListPage.tsx`

Wire the page into routing and add the "Positions" link to the event row actions.

- [ ] **Step 6.1: Add the lazy-import**

In `src/routes.tsx`, after the line:

```ts
const UsersPage = lazy(() => import('./pages/admin/UsersPage'));
```

add:

```ts
const PositionsPage = lazy(() => import('./pages/admin/PositionsPage'));
```

- [ ] **Step 6.2: Add the route**

Still in `src/routes.tsx`, inside the `/admin` children array, add a new entry directly after the `events/:eventSlug/tents/:tentId` block (so it sits between the tents routes and the categories route — matching the visual nav order):

```ts
{
  path: 'events/:eventSlug/positions',
  element: (
    <RequireEventRole minRole="contributor">
      {suspended(<PositionsPage />)}
    </RequireEventRole>
  ),
},
```

Contributors get read-only (no Save button — gated inside the page by `canEdit`); editors can drag and save.

- [ ] **Step 6.3: Add the row-action link in EventListPage**

In `src/pages/admin/EventListPage.tsx`, find the `<Link>` block for `action_manage` (around line 64-69). Directly after that closing `</Link>`, insert:

```tsx
<Link
  to={`/admin/events/${e.slug}/positions`}
  className="hidden underline md:inline"
>
  {t('admin.event_list.action_positions')}
</Link>
```

The `hidden md:inline` classes hide the link on viewports below the Tailwind `md` breakpoint, matching the spec's "desktop only" requirement.

- [ ] **Step 6.4: Run the full test suite and lint**

```bash
pnpm test:run
pnpm lint
pnpm tsc --noEmit
```

Expected: all green. If the existing `EventListPage.test.tsx` asserts on the row-action link count, update it to expect the additional link.

- [ ] **Step 6.5: Commit**

```bash
git add src/routes.tsx src/pages/admin/EventListPage.tsx
git commit -m "feat(positions): wire route and event-list link"
```

---

## Task 7 — Manual smoke checklist

**Files:**
- Create: `tests/manual/positions-editor-smoke.md`

Per `feedback_workflow.md`, every map-touching feature needs a manual desktop smoke checklist.

- [ ] **Step 7.1: Write the checklist**

Create `tests/manual/positions-editor-smoke.md`:

```markdown
# Positions Editor — Manual Smoke Checklist

Run after every PR touching `PositionsPage`, `PositionsMap`, `PositionsTentList`, or `useDirtyPositions`.

## Setup
- Run `pnpm dev` and sign in as an editor or owner of an event that has at least 5 placed tents and 1 unplaced tent.

## Navigation
- [ ] On `/admin/events` row actions, the "Positions" link appears between "Manage" and "Categories" (desktop view).
- [ ] On a narrow viewport (resize to < 768px), the "Positions" link is hidden in the row actions.
- [ ] Open the Positions page directly on a narrow viewport — the mobile-gate copy renders with a link back to the tent list. The link works.

## Layout
- [ ] Side list shows Placed (N) section with all placed tents, each row showing `#display_number` and name.
- [ ] Side list shows Unplaced (M) section when ≥1 unplaced tent exists; Unplaced rows are not clickable.
- [ ] If every tent is placed, the Unplaced section is not rendered at all.
- [ ] Map fills the remaining width and is at least 70% of the viewport width.

## Drag + dirty state
- [ ] Dragging a green marker turns it yellow (dirty ring) and adds a `↺` revert button on its side-list row.
- [ ] The "Save changes (N)" button increments as more markers are dragged.
- [ ] Dragging a marker back to its original spot (or very close) removes the dirty state.
- [ ] Clicking `↺` on a dirty row in the side list reverts that single marker without affecting others.

## Side-list ↔ map sync
- [ ] Clicking a placed row in the side list causes the map to fly to that tent at zoom 20.
- [ ] The clicked row stays visually highlighted while the map is centered on it.

## Save flow
- [ ] "Save changes (2)" on two dirty markers shows a success toast "2 positions saved", and the side list dirty-state clears.
- [ ] Reloading the page shows the new coordinates persisted (markers stay where they were dragged to).
- [ ] Simulate a save failure (e.g., disconnect network or revoke RLS): the partial-error toast appears and the failing tent stays dirty.

## Discard
- [ ] With dirty changes, "Discard all" opens a confirm modal with the dirty count.
- [ ] Cancel keeps the dirty state; Discard clears all edits and resets markers to their saved positions.

## Navigation guards
- [ ] With dirty edits, navigating via in-app link prompts "You have unsaved changes" before leaving.
- [ ] Closing the tab with dirty edits triggers the browser's "leave site" confirmation.
- [ ] After a successful save, navigating away does NOT prompt.

## Style toggle
- [ ] Map/Satellite toggle in the bottom-right works (same control as the tent map editor).
- [ ] Toggle choice survives a reload of the page (localStorage).

## Contributor (read-only) view
- [ ] Sign in as a contributor of the event. Open the Positions page.
- [ ] Markers are visible but NOT draggable.
- [ ] Save and Discard buttons are not rendered.
- [ ] Side-list rows have no revert buttons.
```

- [ ] **Step 7.2: Commit**

```bash
git add tests/manual/positions-editor-smoke.md
git commit -m "docs(positions): add manual desktop smoke checklist"
```

---

## Task 8 — Run the full smoke and open the PR

**Files:** none — only test + push + open PR.

- [ ] **Step 8.1: Run full test suite, lint, and typecheck**

```bash
pnpm test:run
pnpm lint
pnpm tsc --noEmit
```

Expected: all green.

- [ ] **Step 8.2: Walk through `tests/manual/positions-editor-smoke.md` end-to-end against `pnpm dev`**

For each unchecked box: try the step, then mark it `[x]` in the file. Commit the marked-up checklist if any boxes flipped.

- [ ] **Step 8.3: Push and open the PR**

```bash
git push -u origin feat/positions-editor
gh pr create --title "feat(positions): bulk position editor for tents" --body "$(cat <<'EOF'
## Summary
- Desktop-only admin page at `/admin/events/:eventSlug/positions` showing all placed tents on one large map with draggable markers.
- Stage + Save-all batch flow (`useDirtyPositions` hook): drag many tents, then commit in one go via `Promise.allSettled`.
- New "Positions" link in the event list row actions, desktop-only.
- Read-only mode for contributors; full edit for editors/owners.
- Mobile-gate copy on narrow viewports.

Spec: `docs/superpowers/specs/2026-06-01-bulk-position-editor-design.md`
Plan: `docs/superpowers/plans/2026-06-01-bulk-position-editor.md`

## Test plan
- [ ] `pnpm test:run` — all green (new tests for hook, both components, page).
- [ ] `pnpm lint && pnpm tsc --noEmit` — clean.
- [ ] Walk the manual smoke checklist `tests/manual/positions-editor-smoke.md`.
- [ ] Vercel preview deploy → sign in, drag a marker, save, reload, confirm persisted.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

- **Spec coverage:** All design-spec sections map to tasks: hook (Task 2), side list (Task 3), map (Task 4), page incl. mobile gate / save / discard / navigation guard (Task 5), routing + event-list link (Task 6), i18n (Task 1), permissions read-only mode (Task 5 + Task 6), manual smoke (Task 7).
- **No placeholders:** every step has either code or a concrete command + expected output. No TBDs, no "similar to Task N", no abstract "handle errors".
- **Type consistency:** `Coords`, `PositionsMapTent`, `PositionsTentListItem`, `UseDirtyPositionsApi` shapes are defined once (Tasks 2, 3, 4) and reused verbatim by the page in Task 5. `dirty.dirtyIds` is a `Set<string>` in every consumer. `commit(ids: string[])` signature is consistent across hook + page + spec.
