# Bulk Position Editor — Design Spec

**Date:** 2026-06-01
**Status:** Approved by user, ready for implementation planning

## Goal

A desktop-only admin page that shows all placed tents of an event on one large
map and lets an editor drag markers to fine-tune their positions, with changes
staged in memory and committed in a single batch save.

The per-tent map in `TentEditPage` is too small for precise positioning. This
new view solves that, and lets the admin reposition many tents back-to-back
without round-tripping through the tent list.

## Non-Goals

- No drag-from-sidebar to place unplaced tents (use the per-tent editor for
  first placement).
- No multi-select or bulk drag.
- No optimistic-concurrency check on save — last write wins.
- No search/filter in the side list (Phase 1 events have < 100 tents).
- No "clear coordinates" from this view — keep the destructive action in the
  per-tent editor only.
- No mobile UI — narrow viewports see a gate screen.

## Architecture

One new admin page + one new route + one row-action link in `EventListPage`.
**No new tables, no migrations** — `tents.lat`/`lng` already exist as nullable
doubles. Save = N parallel `update().eq('id', ...)` calls, one per dirty tent.

## Route + Navigation

- **Route:** `/admin/events/:eventSlug/positions` (added to `src/routes.tsx`
  alongside the existing `tents`, `categories`, `settings`, `users` siblings).
- **Nav slot:** A new `<Link>` in `EventListPage.tsx` row actions, between
  "Manage" and "Categories", labelled "Positions" / "Positionen".
- **Desktop-only on the link:** Tailwind `hidden md:inline-block` so mobile
  users don't see a feature that won't work for them.

## Page Layout

```
┌──────────────────────────────────────────────────────────┐
│  TopBar (existing AdminLayout)                           │
├────────────────┬─────────────────────────────────────────┤
│ Side list      │                                         │
│ ────────────── │                                         │
│ Placed (12)    │           Large Leaflet map             │
│  #1  Foo       │           (flex-1, fills remaining)     │
│  #2  Bar       │                                         │
│  #3  Baz  ↺   │           - draggable markers           │
│  ...           │           - OSM/Satellite toggle        │
│                │           - zoom up to 22               │
│ Unplaced (2)   │           - flyTo on side-list click    │
│  Quux          │                                         │
│  Zoo           │                                         │
│                │                                         │
├────────────────┴─────────────────────────────────────────┤
│  Save changes (3)            Discard all                 │
└──────────────────────────────────────────────────────────┘
```

Side list is fixed-width (~14rem), the map fills the rest. The footer (save +
discard) sits below both columns. When there are zero dirty tents the footer
shows only a disabled "Save changes (0)" — discard is hidden.

### Mobile gate

On viewports narrower than the Tailwind `md` breakpoint (768px), the page
renders a centered message instead of the map+list:

> "This view requires a desktop screen. Use the [tent list](#) on mobile."

The link goes to `/admin/events/:eventSlug/tents`.

## Components

### `src/pages/admin/PositionsPage.tsx`

Page shell. Responsibilities:
- Load event via `useEvent(eventSlug)`.
- Load all tents for the event via `useTents(event.id)`.
- Check `useEventPermissions().canEdit` for the current user.
- Hold the dirty-position state via `useDirtyPositions` (see below).
- Render either the mobile gate, or the side list + map + footer.
- Handle save (parallel `Promise.allSettled` over dirty tents) and discard.
- Wire up `useBlocker` (react-router) + `beforeunload` for unsaved-change
  navigation guards.
- Show success/error toasts via `useToast`.

### `src/components/PositionsMap.tsx`

Leaflet map with N draggable markers. Responsibilities:
- Accept `tents` (placed only), `dirtyIds: Set<string>`, `focusTentId | null`,
  `canEdit`, `tileStyle`, `onTileStyleChange`, `onPositionChange(id, lat, lng)`.
- Render one `<Marker>` per placed tent. Marker is draggable if `canEdit` and
  static otherwise. Dirty markers get a distinguishing visual (yellow ring +
  always-visible number label, ignoring `MARKER_DETAIL_ZOOM` threshold).
- On `dragend`, call `onPositionChange(id, lat, lng)`.
- A `<FlyToController>` child that runs `map.flyTo(focusCoords, TENT_FOCUS_ZOOM)`
  whenever `focusTentId` changes (mirrors the public-map `TentFocusController`
  pattern but simpler — no offset center needed, full-viewport center is fine).
- Tile layer + `MapStyleToggle` placed bottom-right (matches `MapView`).
- Map center on first paint = event default; zoom = event default.
- **Clicking blank map does nothing.** No click-to-place semantics — prevents
  accidents. Drag-only.

### `src/components/PositionsTentList.tsx`

Side panel listing all tents. Responsibilities:
- Show two sections: "Placed (N)" and "Unplaced (M)". Section headers use
  i18n keys.
- Each row in "Placed": `#display_number  name  [↺ revert button when dirty]`.
  Clicking a row (anywhere outside the revert button) sets the focused tent
  id, which makes the map fly to it.
- Each row in "Unplaced": `name` only, greyed out. Not clickable here.
- Selected/focused tent gets a highlight ring on its row.
- Empty placed section: "No tents placed yet."
- Empty unplaced section: hidden entirely (don't show a "0 unplaced" stub).

### `src/hooks/useDirtyPositions.ts`

Pure-React hook (no Supabase). Tracks per-tent edited positions vs. originals:

```ts
type Coords = { lat: number; lng: number };
type DirtyMap = Record<string, Coords>; // id -> edited coords

export function useDirtyPositions(originals: Record<string, Coords>) {
  const [edits, setEdits] = useState<DirtyMap>({});
  // The hook does NOT auto-reset on originals change. The caller (page) owns
  // the lifecycle: it calls commit(ids) after a successful save, and lets the
  // refetch refresh originals. This avoids clobbering an in-flight edit if
  // originals happen to re-resolve to a structurally-equal value.
  return {
    isDirty: (id: string) => id in edits,
    dirtyIds: new Set(Object.keys(edits)),
    /** Returns edited coords if dirty, else originals[id]. */
    getCoords: (id: string) => edits[id] ?? originals[id],
    set: (id: string, coords: Coords) => {
      // If coords match originals (within ~1e-9), drop the entry instead.
      setEdits((prev) => /* ... */);
    },
    revert: (id: string) => setEdits(({ [id]: _, ...rest }) => rest),
    revertAll: () => setEdits({}),
    /** Drop the given ids from edits. Use after a successful save. */
    commit: (ids: string[]) =>
      setEdits((prev) => {
        const next = { ...prev };
        for (const id of ids) delete next[id];
        return next;
      }),
    dirtyCount: Object.keys(edits).length,
  };
}
```

Why a hook rather than inlining in `PositionsPage`: testability and clarity.
The dirty-state logic has 5+ cases (drag, drag-back-to-original, revert single,
revert all, commit on save) and deserves its own surface.

## Data Flow

1. `PositionsPage` mounts → `useEvent` loads event, then `useTents` loads tents.
2. Tents arrive → split into `placed` (lat+lng set) and `unplaced` arrays.
3. `originals` = `{ [tent.id]: {lat, lng} }` for placed tents only — passed to
   `useDirtyPositions`.
4. `PositionsMap` renders one marker per placed tent at `getCoords(id)`.
5. User drags a marker → `onPositionChange(id, lat, lng)` → `dirty.set(id, ...)`
   → marker re-renders at new position with dirty styling, side-list row gets
   a revert button.
6. User clicks "Save changes (N)" →
   ```ts
   const results = await Promise.allSettled(
     [...dirty.dirtyIds].map(id =>
       supabase.from('tents')
         .update({ lat: dirty.getCoords(id).lat, lng: dirty.getCoords(id).lng })
         .eq('id', id)
     )
   );
   ```
   - All fulfilled → `dirty.commit(allIds)`, reload tents (so `originals`
     updates), show "N positions saved" toast.
   - Some rejected → call `dirty.commit(fulfilledIds)` so only the failed ones
     remain dirty; reload tents; toast "M of N positions saved, K failed:
     <first error message>".
7. User clicks "Discard all" → confirm modal → `dirty.revertAll()`.

## Permissions

- **Route gate:** `RequireAuth` (already protects the admin tree).
- **Edit gate:** `useEventPermissions().canEdit` decides whether markers are
  draggable and whether the save/discard footer is shown. Contributors see the
  page in read-only mode (markers static, no footer, no revert buttons in the
  list). This matches how `TentListPage` already gates `canEdit`.

## Navigation Guards

- `useBlocker` from react-router-dom: when `dirty.dirtyCount > 0`, intercept
  in-app navigation with a confirmation dialog.
- `window.addEventListener('beforeunload', handler)` for tab close / external
  navigation. Standard pattern.
- Successful save clears dirty → guards stop firing.

## i18n Keys

Add to both `src/locales/de/common.json` and `src/locales/en/common.json`,
under `admin.positions`:

| Key | EN | DE |
|---|---|---|
| `heading` | Positions — {{title}} | Positionen — {{title}} |
| `placed_heading` | Placed ({{count}}) | Platziert ({{count}}) |
| `unplaced_heading` | Not placed ({{count}}) | Nicht platziert ({{count}}) |
| `unplaced_empty` | No tents placed yet. | Noch keine Stände platziert. |
| `revert_aria` | Revert {{name}} to saved position | {{name}} auf gespeicherte Position zurücksetzen |
| `save_button` | Save changes ({{count}}) | Änderungen speichern ({{count}}) |
| `saving` | Saving… | Wird gespeichert… |
| `discard_button` | Discard all | Alle verwerfen |
| `discard_confirm_heading` | Discard {{count}} changes? | {{count}} Änderungen verwerfen? |
| `discard_confirm_body` | All unsaved position changes will be lost. | Alle nicht gespeicherten Positionsänderungen gehen verloren. |
| `discard_confirm_submit` | Discard | Verwerfen |
| `discard_confirm_cancel` | Cancel | Abbrechen |
| `save_success` | {{count}} positions saved. | {{count}} Positionen gespeichert. |
| `save_partial_error` | {{ok}} of {{total}} saved. {{failed}} failed: {{message}} | {{ok}} von {{total}} gespeichert. {{failed}} fehlgeschlagen: {{message}} |
| `nav_guard_message` | You have unsaved position changes. Leave anyway? | Du hast nicht gespeicherte Positionsänderungen. Trotzdem verlassen? |
| `mobile_gate_title` | Desktop screen required | Desktopbildschirm erforderlich |
| `mobile_gate_body` | This view requires a desktop screen. | Diese Ansicht benötigt einen Desktopbildschirm. |
| `mobile_gate_link` | Open tent list | Standliste öffnen |

Also add `admin.event_list.action_positions` → "Positions" / "Positionen" for
the row-action link.

## Testing

### `tests/unit/hooks/useDirtyPositions.test.ts`
- `set()` adds a dirty entry; `isDirty(id)` returns true.
- `set()` to original coords (within epsilon) drops the entry, not adds it.
- `revert(id)` removes a single entry; other dirty tents unaffected.
- `revertAll()` clears every entry.
- `commit(ids)` drops only the listed ids; other dirty tents stay dirty.
- `getCoords(id)` returns edits when dirty, originals otherwise.
- `dirtyCount` is correct after each operation.

### `tests/unit/components/PositionsTentList.test.tsx`
- Renders both Placed and Unplaced sections with correct counts and rows.
- Empty Unplaced section is not rendered.
- Empty Placed section shows the empty message.
- Clicking a placed row fires `onSelect(id)`.
- Revert button only appears on dirty rows.
- Clicking the revert button fires `onRevert(id)` and does NOT fire `onSelect`.
- `canEdit=false`: no revert buttons rendered, even on dirty rows.

### `tests/unit/components/PositionsMap.test.tsx`
- Renders one marker per placed tent.
- Marker drag (`dragend`) calls `onPositionChange(id, lat, lng)`.
- Dirty markers get the dirty styling (mock by asserting on the icon's html).
- `canEdit=false`: markers are not draggable.
- `focusTentId` change triggers `flyTo` on the map (mock map.flyTo).
- Clicking the blank map does nothing (no `onPositionChange` call).

### `tests/unit/pages/PositionsPage.test.tsx`
- Mobile gate renders below `md` breakpoint (mock `window.matchMedia` or use a
  test viewport).
- Save fires N parallel `supabase.from('tents').update({lat,lng}).eq('id',id)`
  calls — one per dirty tent.
- Save success: dirty cleared, success toast shown.
- Save partial failure: failed tents remain dirty, error toast shown with the
  partial summary.
- Discard-all opens confirm modal; confirm clears all dirty state.
- Save button disabled when `dirtyCount === 0`.
- Read-only (canEdit=false): no save/discard footer.

## File Inventory

**New:**
- `src/pages/admin/PositionsPage.tsx`
- `src/components/PositionsMap.tsx`
- `src/components/PositionsTentList.tsx`
- `src/hooks/useDirtyPositions.ts`
- `tests/unit/hooks/useDirtyPositions.test.ts`
- `tests/unit/components/PositionsTentList.test.tsx`
- `tests/unit/components/PositionsMap.test.tsx`
- `tests/unit/pages/PositionsPage.test.tsx`

**Modified:**
- `src/routes.tsx` — add `events/:eventSlug/positions` route.
- `src/pages/admin/EventListPage.tsx` — add "Positions" link between Manage and
  Categories, with `hidden md:inline-block`.
- `src/locales/de/common.json` — new `admin.positions.*` and
  `admin.event_list.action_positions` keys.
- `src/locales/en/common.json` — same keys, English copy.

No DB migrations.

## Risks & Mitigations

- **Many markers at low zoom overlap visually.** Mitigation: the dirty marker
  always shows its `#display_number` label so the admin can identify what was
  moved; the side list is the canonical navigation tool when markers cluster.
- **A misdrag is hard to undo precisely** (the user can't remember the original
  to four decimals). Mitigation: per-tent `↺ revert` button reads from
  `originals` (the DB-committed coords), restoring exactly.
- **User loses changes on accidental navigation.** Mitigation: `useBlocker` +
  `beforeunload` guards on unsaved state.
- **Save partial failure.** Mitigation: `Promise.allSettled` + per-tent retain
  of failed dirty entries, with a partial-failure toast.

## Open Decisions — none

All previously open questions have been answered:
- Save model: **stage + Save** (user-confirmed).
- Layout: **map + side list with placed/unplaced sections** (user-confirmed).
- Click-to-place: **disabled** (drag-only).
- Unplaced tents: **shown read-only in the side list, no map marker**.
- Mobile: **gate screen, no editor UI**.
