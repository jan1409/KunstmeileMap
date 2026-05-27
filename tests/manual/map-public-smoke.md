# Map Public View — Manual Smoke

Run against the Vercel preview URL for `feat/map-pivot`. Test on desktop + at least one mobile device.

- [ ] Page loads, map appears centered at the event's `default_lat/default_lng/default_zoom`.
- [ ] OSM attribution visible bottom-right (`© OpenStreetMap contributors`).
- [ ] Tents with `lat/lng` set render as colored circles with their `display_number`.
- [ ] Tents without coords do NOT appear on the map. A banner shows their count.
- [ ] Click a marker → SidePanel opens with the tent's details, photos, and social links.
- [ ] URL deep-link to `/<event>/tent/<slug>` opens that tent's SidePanel on load.
- [ ] Click outside SidePanel (or the close ✕) → SidePanel closes, URL returns to `/<event>`.
- [ ] Filter by category in TopBar → non-matching tent markers disappear; selecting all/none shows all.
- [ ] "Back to overview" button appears when a tent is selected; clicking it deselects.
- [ ] DE/EN switch in TopBar: banner text and SidePanel descriptions switch language.
- [ ] On mobile: pinch-to-zoom works, drag-to-pan works, tap on marker opens SidePanel from the bottom.
- [ ] No console errors. No 401s on Vercel preview (login if needed).

## Zoom-based marker detail (added 2026-05-27)

- [ ] At the event's default zoom (typically 18), all tents render as small colored dots without numbers visible.
- [ ] Zooming in once with the + button (to zoom 19) keeps the dots — still no numbers.
- [ ] Zooming in once more (to zoom 20) switches every marker to the full numbered badge.
- [ ] Zooming back out crosses the threshold the other way and dots return.
- [ ] Filter by category still hides/shows the dots correctly.
- [ ] Clicking a dot opens the SidePanel for that tent (same behavior as clicking a full marker).
- [ ] On a touch device, a single tap on a dot reliably opens the SidePanel (hit-area is 24×24 px even though the visual is 12×12).
