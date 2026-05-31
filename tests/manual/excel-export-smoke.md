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
- [ ] Column-shape sanity: open the exported file alongside `public/import-template.xlsx`. The header row of the export must match the template's column order and names exactly — same 13 columns, same names. This is the contract that lets the file be re-imported into a **new/empty event** without manual reformatting.
- [ ] (Optional) Bulk-import into a fresh event: create a new event in the admin, then upload the exported file via that event's `/admin/events/<new-slug>/tents/import`. Preview should show all rows ✅ (or ⚠️ for unknown categories if the new event has different category slugs). After commit, the new event has the same stands. **Re-importing into the SAME event will fail with "slug duplicated" + "display_number duplicated" — that is expected; the wizard is insert-only by design.**

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
