# Special marker icons — Manual Smoke

Run against the Vercel preview for `feat/special-marker-icons`.

> **Prerequisite:** the migration `20260602120000_tent_marker_icon.sql` must be applied
> to the Supabase project the preview points at (`supabase db push` on the linked project).
> Without it, saving a stand with a symbol fails ("column marker_icon does not exist").

## Admin — set a symbol

- [ ] Open `/admin/events/<slug>/tents/<id>` for a food stand. A "Kartensymbol / Map symbol"
      dropdown appears below "Categories", defaulting to "Keins (Nummer anzeigen)".
- [ ] Pick "Burger", save. Re-open the stand — the dropdown still shows "Burger" (round-trips).
- [ ] Set another stand to "Parkplatz / Parking" and save.

## Public map — render

- [ ] Open the public map and zoom in past the detail threshold (z ≥ 20) so full badges show.
  - [ ] The burger stand's badge shows the burger glyph instead of its number.
  - [ ] The parking stand shows the "P" parking glyph.
  - [ ] Stands without a symbol still show their display number.
- [ ] Zoom out below the threshold — all markers collapse to plain colored dots (no glyph),
      same as before.
- [ ] Click the burger stand — the side panel header shows the burger glyph next to `#<number>`.

## Edge cases

- [ ] A stand whose `marker_icon` holds an unknown/old key falls back to the number (no crash).
- [ ] Works in both DE and EN locales (toggle in the admin header / public top bar).
- [ ] No console errors on the map or in the editor.
