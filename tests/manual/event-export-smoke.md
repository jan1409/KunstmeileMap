# Event export (ZIP) — Manual Smoke

Run against the Vercel preview for `feat/event-export`. Requires an **owner** login
(the Settings page is owner-only).

## Export

- [ ] Open `/admin/events/<slug>/settings`. An "Export event / Event exportieren" section
      appears at the bottom with a "↓ Export event (ZIP)" button.
- [ ] Click it. The button shows live progress ("Exporting… 12/48 photos") while photos
      download, then a browser download starts: `kunstmeile-<slug>-export-YYYY-MM-DD.zip`.
- [ ] A green "Export ready (N stands, M photos)" message appears.

## Unzip and inspect

- [ ] Unzip the file. The root contains `index.html` plus one folder per stand named
      `<display_number>_<slug>` (e.g. `3_galerie-nord`, `x_<slug>` for an unnumbered stand).
- [ ] Open the root `index.html`: shows the event title (DE / EN), year, dates, venue, and a
      list of all stands. Each entry links to `<folder>/index.html`. Links open the stand page.
- [ ] Open a stand's `index.html`:
  - [ ] Shows `#number Name`, categories, and all set fields (contact person, address,
        website/instagram/facebook as links, email, coordinates).
  - [ ] Both the German **and** English descriptions are shown (whichever are filled).
  - [ ] A "Fotos / Photos" gallery at the bottom shows the stand's photos; clicking one opens
        the local full-resolution file.
  - [ ] The "← <event title>" link returns to the overview.
- [ ] Photo files inside a folder are named `<number>_<slug>_photo_01.<ext>`, `_photo_02`, …
      and are the **original** (uncompressed) images, not thumbnails.

## Edge cases

- [ ] A stand with no photos still gets a folder + `index.html` (no gallery section).
- [ ] If a photo fails to download, an amber "N file(s) … were skipped" note appears and the
      rest of the export still completes (the missing file is simply absent + unlinked).
- [ ] Works in DE and EN admin locales. No console errors during export.
