/**
 * Regenerates `public/import-template.xlsx` — the .xlsx shown behind
 * "Download template" in the bulk-import wizard. The template's column order
 * MUST match `TENT_EXPORT_COLUMNS` in `src/lib/excel.ts` so a download →
 * fill-in → upload round-trip works without renaming columns.
 *
 * Run from the repo root after changing the schema:
 *   node scripts/build-import-template.mjs
 *
 * Commit the resulting xlsx alongside this script.
 */
import { utils, writeFile } from 'xlsx';

// Canonical lowercase English headers, identical to the Excel-Export output.
// The import wizard also accepts "Ansprechperson" / "Contact Person" as
// aliases for `contact_person` (see TentImportPage's HEADER_ALIASES).
const HEADERS = [
  'name',
  'contact_person',
  'display_number',
  'slug',
  'category_slugs',
  'description_de',
  'description_en',
  'address',
  'website_url',
  'instagram_url',
  'facebook_url',
  'email_public',
  'lat',
  'lng',
];

// One sample row so first-time users see what each cell should look like.
// Mirrors the example that lived in the previous template.
const SAMPLE = [
  'Galerie Müller',
  'Anna Müller',
  42,
  '',
  'painting',
  'Zeitgenössische Malerei',
  'Contemporary painting',
  'Hauptstraße 1',
  'https://example.com',
  '',
  '',
  '',
  49,
  8.4,
];

const ws = utils.aoa_to_sheet([HEADERS, SAMPLE]);
const wb = utils.book_new();
utils.book_append_sheet(wb, ws, 'Tents');
writeFile(wb, 'public/import-template.xlsx');

console.log('Wrote public/import-template.xlsx with', HEADERS.length, 'columns.');
