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
