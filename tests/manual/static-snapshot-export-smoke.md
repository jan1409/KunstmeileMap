# Web-optimized static snapshot export — Manual Smoke

Run against a **production build** (`npm run build` + `npm run preview`) or a Vercel
preview — the export fetches `/viewer.html`, which only exists after a build, so it does
**not** work against the `npm run dev` server.

> Automated coverage already verifies the offline bundle headlessly (map + markers render,
> deep-link side panel works, no edit controls leak, no runtime errors) — see the smoke
> approach in the PR description. This checklist covers the admin flow + a real upload-backed
> event, which the automated smoke (synthetic data, no photos) does not.

## Admin — produce the export

- [ ] Open `/admin/events/<slug>/settings` as an owner. Below the original "Event exportieren"
      section there is a second section "Web-Version exportieren (für statische Website)".
- [ ] Click "↓ Web-Version exportieren (ZIP)". A progress label counts photos
      (`Exportiere… n/total Fotos`), then a `kunstmeile-<slug>-web-<date>.zip` downloads.
- [ ] If any photos fail, an amber "… übersprungen" line appears (non-fatal).

## Inspect the ZIP

- [ ] It contains `index.html`, a `photos/<n>_<slug>/NN.jpg` tree, and `README.txt`.
- [ ] Spot-check a photo: long edge ≈ 1600px and the file is far smaller than the original
      (typically 150–350 KB, not multiple MB).

## View as static content

- [ ] Unzip and serve the folder with a plain static server (e.g. `npx serve <folder>`):
  - [ ] The interactive map loads with markers; special marker icons (food/parking) show.
  - [ ] The category filter and search work.
  - [ ] Clicking a marker opens the side panel with info + photo grid; the photo lightbox
        opens and navigates (←/→, Esc).
  - [ ] The language toggle (DE/EN) works.
  - [ ] **No** edit/upload controls appear anywhere ("Foto hinzufügen", "Fotos verwalten", …).
- [ ] Double-click `index.html` to open it via `file://`: everything above still works
      (map tiles require an internet connection; all other content is offline).
- [ ] In DevTools → Network, confirm there are **no** requests to Supabase — only
      OpenStreetMap tile requests.
