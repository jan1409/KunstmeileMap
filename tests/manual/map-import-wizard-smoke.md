# Import Wizard — Manual Smoke

- [ ] Open `/admin/events/<slug>/tents/import`.
- [ ] Click "Vorlage herunterladen" → .xlsx downloads, opens in Excel with one example row.
- [ ] Modify the template: add 5 valid rows, 1 row missing name, 1 row with duplicate display_number, 1 row with unknown category slug, 1 row with invalid URL, 1 row with lat=91 (out of range).
- [ ] Upload the modified .xlsx → preview shows: 5 OK ✅, several ⚠️/❌ depending on which rows you put what error in.
- [ ] Click "Import N rows" → only OK + warning rows persisted; errors skipped.
- [ ] Verify in tent list: imported tents are visible.
- [ ] Verify on public map: tents with valid lat/lng appear at correct positions.
- [ ] Repeat with a CSV file (export the .xlsx as .csv from Excel). Same behavior.
- [ ] Try uploading a .txt or .ods → alert shown.
