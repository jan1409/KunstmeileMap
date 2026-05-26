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
