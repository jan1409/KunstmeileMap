# Admin Map Editor — Manual Smoke

- [ ] Log in as admin. Open `/admin/events/<slug>/tents/<tent-slug>` for a tent that has no coordinates.
- [ ] The map shows centered on the event's default lat/lng/zoom, no marker.
- [ ] Click somewhere on the map → marker appears there; Lat/Lng inputs update to match.
- [ ] Drag the marker → Lat/Lng inputs update live as you drag.
- [ ] Type a value into the Lat input (e.g., bump by 0.001) → marker jumps to the new position.
- [ ] Click "Koordinaten löschen" → inputs clear, marker disappears.
- [ ] Click on the map again → coords come back.
- [ ] Save the tent → reload the page → coords persist.
- [ ] Open the public viewer → the tent now appears at the saved position.
- [ ] Open EventSettings → change default_zoom from 17 to 18 → save → reload public viewer → initial zoom is 18.
- [ ] Open EventSettings → set default_lat/lng to the real venue coords → save → public map opens centered there.

## Zoom-based neighbor markers (added 2026-05-27)

- [ ] At the event's default zoom, neighboring already-placed tents appear as small green dots (no numbers).
- [ ] Zooming in past zoom 20 reveals the green numbered badges for the same neighbors.
- [ ] The red current pin (the tent you are placing) keeps its size at all zoom levels — never becomes a dot.
- [ ] Clicking a green neighbor dot does nothing (they are non-interactive context markers).
- [ ] Dragging the red pin still works at any zoom.
