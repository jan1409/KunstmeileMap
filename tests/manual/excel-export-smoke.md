# Excel-Export — Manual Smoke

Run against the Vercel preview for `feat/excel-export` (URL pattern: `kunstmeile-map-git-feat-excel-export-kunstmeile.vercel.app`).

## Stände-Export

- [ ] Open `/admin/events/<slug>/tents`. The "↓ Excel-Export" button is visible next to "CSV-Import".
- [ ] Click the button. Browser triggers a download named `kunstmeile-<event-slug>-tents-YYYY-MM-DD.xlsx`.
- [ ] Open the file in Excel / Numbers / LibreOffice.
  - [ ] The first row is the header with 13 columns in this order:
    `name, display_number, slug, category_slugs, description_de, description_en, address, website_url, instagram_url, facebook_url, email_public, lat, lng`
  - [ ] One row per stand of the current event.
  - [ ] `category_slugs` is comma-separated (`painting,sculpture`) when a stand has multiple categories; empty when none.
  - [ ] Empty fields show as empty cells (not `null`).
- [ ] Round-trip: edit a description in the .xlsx (e.g., add "EXPORT-TEST" to one row's `description_de`), save, then re-upload via `/admin/events/<slug>/tents/import`. The preview step should show all rows OK (or warnings for unknown categories, which is also expected if you renamed something). After commit, check `/admin/events/<slug>/tents/<id>` for that stand and verify the description was updated.

## Kategorien-Export

- [ ] Open `/admin/events/<slug>/categories`. The "↓ Excel-Export" button is visible next to "+ Neue Kategorie".
- [ ] Click the button. Browser triggers download named `kunstmeile-<event-slug>-categories-YYYY-MM-DD.xlsx`.
- [ ] Open the file in Excel.
  - [ ] First row is the header: `slug, name_de, name_en, icon, display_order`.
  - [ ] One row per category, sorted by display_order ascending.
  - [ ] Empty `name_en` or `icon` cells stay empty.

## Edge cases

- [ ] On an event with **zero** tents, the Stände-Export button is still clickable; downloaded file has header row only.
- [ ] On an event with **zero** categories, the Kategorien-Export button is **disabled** (greyed out).
- [ ] Both buttons work in both DE and EN locales (toggle via the LanguageToggle in the admin header).
- [ ] No console errors during download.
