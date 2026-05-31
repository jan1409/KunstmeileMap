# Excel Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two `.xlsx` export buttons in the admin — one on `TentListPage`, one on `CategoryListPage` — each producing a date-stamped, round-trip-friendly download of the current event's data.

**Architecture:** Two pure helper functions in `src/lib/excel.ts` (alongside the existing import helpers) build the workbooks via SheetJS. Each list page gets an export button whose handler invokes the helper and triggers a download with a tiny inlined `URL.createObjectURL`/`<a download>` snippet. TentListPage does its own one-off supabase fetch on export-click (to load the categories join the page's main fetch doesn't include) — this keeps the page's normal render bandwidth unchanged.

**Tech Stack:** React 19 + TypeScript 6 + Vitest 4 + RTL + SheetJS (`xlsx`, already in the project). No new dependencies, no DB migration, no new routes.

**Spec:** [docs/superpowers/specs/2026-05-27-excel-export-design.md](../specs/2026-05-27-excel-export-design.md)

**Working branch:** `feat/excel-export` (already created from `main` at `16dca51`; the spec commit `a4231c6` is the only commit on the branch so far).

---

## File Structure

### Files to create

| Path | Responsibility |
|---|---|
| `tests/manual/excel-export-smoke.md` | Manual smoke checklist (download, open, round-trip). |

### Files to modify

| Path | Change |
|---|---|
| `src/lib/excel.ts` | Append two exported helpers: `exportTentsToBlob(tents: TentWithCategories[]): Blob` and `exportCategoriesToBlob(categories: Category[]): Blob`. Both build `aoa_to_sheet` workbooks via SheetJS and return `Blob`s with the correct MIME type. |
| `tests/unit/lib/excel.test.ts` | Append two new `describe` blocks with ~6 tests total. Tests parse the produced Blob back through `XLSX.read` and assert on the header row, data rows, and edge cases (null values → empty cells, comma-joined category_slugs, sort order for categories). |
| `src/pages/admin/TentListPage.tsx` | Add "↓ Excel-Export" button next to existing "CSV-Import" link. Click handler fetches tents-with-categories on demand (one-off supabase query mirroring the `useTents` hook's select), passes them through `flattenTentCategories`, calls `exportTentsToBlob`, triggers download with an inlined helper. |
| `src/pages/admin/CategoryListPage.tsx` | Add "↓ Excel-Export" button next to existing "+ Neue Kategorie" button. Click handler uses the page's existing `categories` state directly (no extra fetch), calls `exportCategoriesToBlob`, triggers download. |
| `src/locales/de/common.json`, `src/locales/en/common.json` | Add `admin.tent_list.export_xlsx` and `admin.category.export_xlsx` keys. |

### Files NOT modified

- `src/lib/tentCategories.ts` — its existing `flattenTentCategories` helper is reused as-is.
- `src/components/TentEditForm.tsx`, `TentMapEditor.tsx`, `MapView.tsx`, etc. — unaffected.
- Database, migrations, types, routes, public viewer.
- `tests/unit/pages/admin/TentListPage.test.tsx` and `CategoryListPage.test.tsx` — should not break, since the changes are additive (a new button + new handler), but verify after T2/T3.

---

## Task 1 — Pure export helpers in `src/lib/excel.ts`

**Files:**
- Modify: `src/lib/excel.ts` (append two functions)
- Modify: `tests/unit/lib/excel.test.ts` (append two describe blocks)

- [ ] **Step 1.1: Write failing tests for `exportTentsToBlob`**

Open `tests/unit/lib/excel.test.ts`. At the top, extend the existing import to also include the two new helpers:

```ts
import {
  validateRow,
  generateUniqueSlug,
  parserForFilename,
  slugify,
  exportTentsToBlob,
  exportCategoriesToBlob,
} from '../../../src/lib/excel';
```

Add a SheetJS-only import for `XLSX.read` used to parse the blob back in tests:

```ts
import * as XLSX from 'xlsx';
```

Append a new `describe('exportTentsToBlob', ...)` block at the end of the file:

```ts
describe('exportTentsToBlob', () => {
  const minimalTent = {
    id: 't1',
    event_id: 'e1',
    slug: 'galerie-mueller',
    name: 'Galerie Müller',
    display_number: 42,
    description_de: 'Zeitgenössische Malerei',
    description_en: 'Contemporary painting',
    address: 'Hauptstraße 1',
    website_url: 'https://example.com',
    instagram_url: null,
    facebook_url: null,
    email_public: null,
    lat: 49.0,
    lng: 8.4,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    created_by: null,
    updated_by: null,
    categories: [
      { id: 'c1', slug: 'painting', name_de: 'Malerei', name_en: 'Painting', icon: '🎨', display_order: 0 },
      { id: 'c2', slug: 'sculpture', name_de: 'Skulptur', name_en: 'Sculpture', icon: '🗿', display_order: 1 },
    ],
  };

  async function readBlobAsAoa(blob: Blob): Promise<unknown[][]> {
    const buf = await blob.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]!]!;
    return XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
  }

  it('produces the 13-column header row in the expected order', async () => {
    const blob = exportTentsToBlob([minimalTent] as never);
    const aoa = await readBlobAsAoa(blob);
    expect(aoa[0]).toEqual([
      'name',
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
    ]);
  });

  it('serializes a tent with its category slugs comma-joined', async () => {
    const blob = exportTentsToBlob([minimalTent] as never);
    const aoa = await readBlobAsAoa(blob);
    const row = aoa[1]!;
    expect(row[0]).toBe('Galerie Müller');
    expect(row[1]).toBe(42);
    expect(row[2]).toBe('galerie-mueller');
    expect(row[3]).toBe('painting,sculpture');
    expect(row[11]).toBe(49.0);
    expect(row[12]).toBe(8.4);
  });

  it('emits empty cells for null/undefined values', async () => {
    const sparseTent = {
      ...minimalTent,
      display_number: null,
      description_de: null,
      description_en: null,
      address: null,
      website_url: null,
      lat: null,
      lng: null,
      categories: [],
    };
    const blob = exportTentsToBlob([sparseTent] as never);
    const aoa = await readBlobAsAoa(blob);
    const row = aoa[1]!;
    // SheetJS represents empty cells as missing array entries OR empty strings;
    // either is acceptable. Assert the cell is NOT a literal "null" or "undefined".
    expect(row[1]).not.toBe(null);
    expect(row[1] === '' || row[1] === undefined).toBe(true);
    expect(row[3] === '' || row[3] === undefined).toBe(true);
    expect(row[11] === '' || row[11] === undefined).toBe(true);
  });

  it('produces a valid xlsx Blob with the openxml MIME type', () => {
    const blob = exportTentsToBlob([]);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(blob.size).toBeGreaterThan(0);
  });

  it('produces a header-only file when given zero tents', async () => {
    const blob = exportTentsToBlob([]);
    const aoa = await readBlobAsAoa(blob);
    expect(aoa).toHaveLength(1);
    expect(aoa[0]).toHaveLength(13);
  });
});
```

- [ ] **Step 1.2: Write failing tests for `exportCategoriesToBlob`**

Append a second `describe('exportCategoriesToBlob', ...)` block:

```ts
describe('exportCategoriesToBlob', () => {
  const cat = (overrides: Partial<{ id: string; slug: string; name_de: string; name_en: string | null; icon: string | null; display_order: number }> = {}) => ({
    id: overrides.id ?? 'c-id',
    event_id: 'e1',
    slug: overrides.slug ?? 'painting',
    name_de: overrides.name_de ?? 'Malerei',
    name_en: overrides.name_en ?? 'Painting',
    icon: overrides.icon ?? '🎨',
    display_order: overrides.display_order ?? 0,
    created_at: '2026-01-01T00:00:00Z',
  });

  async function readBlobAsAoa(blob: Blob): Promise<unknown[][]> {
    const buf = await blob.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]!]!;
    return XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
  }

  it('produces the 5-column header row', async () => {
    const blob = exportCategoriesToBlob([cat()] as never);
    const aoa = await readBlobAsAoa(blob);
    expect(aoa[0]).toEqual(['slug', 'name_de', 'name_en', 'icon', 'display_order']);
  });

  it('sorts rows by display_order ascending', async () => {
    const blob = exportCategoriesToBlob([
      cat({ slug: 'c', display_order: 2 }),
      cat({ slug: 'a', display_order: 0 }),
      cat({ slug: 'b', display_order: 1 }),
    ] as never);
    const aoa = await readBlobAsAoa(blob);
    expect(aoa[1]![0]).toBe('a');
    expect(aoa[2]![0]).toBe('b');
    expect(aoa[3]![0]).toBe('c');
  });

  it('emits empty cells for null name_en and icon', async () => {
    const blob = exportCategoriesToBlob([
      cat({ name_en: null, icon: null }),
    ] as never);
    const aoa = await readBlobAsAoa(blob);
    const row = aoa[1]!;
    expect(row[2] === '' || row[2] === undefined).toBe(true);
    expect(row[3] === '' || row[3] === undefined).toBe(true);
  });
});
```

- [ ] **Step 1.3: Run the tests, verify they fail**

```bash
pnpm test:run tests/unit/lib/excel.test.ts
```

Expected: FAIL — `exportTentsToBlob is not exported` (or similar). The existing 16 tests in this file still pass.

- [ ] **Step 1.4: Implement the two helpers**

Append to `src/lib/excel.ts` (after `validateRow`, at the bottom of the file):

```ts
import * as XLSX from 'xlsx';
import type { Category, TentWithCategories } from './supabase';

const TENT_EXPORT_COLUMNS = [
  'name',
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
] as const;

const CATEGORY_EXPORT_COLUMNS = [
  'slug',
  'name_de',
  'name_en',
  'icon',
  'display_order',
] as const;

const XLSX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Coerces a nullish DB value to the cell-friendly empty string. */
function cellValue<T>(v: T | null | undefined): T | '' {
  return v == null ? '' : v;
}

/**
 * Build an .xlsx workbook with one "Tents" sheet whose columns mirror the
 * import wizard's RawRow shape (so exported files re-import cleanly).
 * The categories association is read from each tent's already-joined
 * `categories` array (see `flattenTentCategories`); no extra fetch needed.
 */
export function exportTentsToBlob(tents: TentWithCategories[]): Blob {
  const rows = tents.map((t) => [
    t.name,
    cellValue(t.display_number),
    t.slug,
    (t.categories ?? []).map((c) => c.slug).join(','),
    cellValue(t.description_de),
    cellValue(t.description_en),
    cellValue(t.address),
    cellValue(t.website_url),
    cellValue(t.instagram_url),
    cellValue(t.facebook_url),
    cellValue(t.email_public),
    cellValue(t.lat),
    cellValue(t.lng),
  ]);
  const aoa: (string | number | '')[][] = [
    [...TENT_EXPORT_COLUMNS],
    ...rows,
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Tents');
  const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([arrayBuffer], { type: XLSX_MIME_TYPE });
}

/**
 * Build an .xlsx workbook with one "Categories" sheet. Rows are sorted by
 * `display_order` ascending so the file mirrors what admins see in the UI.
 */
export function exportCategoriesToBlob(categories: Category[]): Blob {
  const sorted = [...categories].sort(
    (a, b) => a.display_order - b.display_order,
  );
  const rows = sorted.map((c) => [
    c.slug,
    c.name_de,
    cellValue(c.name_en),
    cellValue(c.icon),
    c.display_order,
  ]);
  const aoa: (string | number | '')[][] = [
    [...CATEGORY_EXPORT_COLUMNS],
    ...rows,
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Categories');
  const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([arrayBuffer], { type: XLSX_MIME_TYPE });
}
```

> **Engineer notes:**
> - `import * as XLSX from 'xlsx'` was already used at file top of `TentImportPage.tsx`; we now add it to `src/lib/excel.ts` too. This means the `xlsx` bundle is no longer lazily-tied to the admin-import route — it'll also be included in any chunk that imports `excel.ts`. For TentListPage and CategoryListPage that's the admin route bundle anyway (same chunk as TentImportPage), so no public-bundle bloat.
> - `import type { Category, TentWithCategories } from './supabase';` — `./supabase` re-exports these types from `src/types/supabase.ts`. Verify the re-export exists; if it doesn't, import from `./tentCategories` (which DOES import `TentWithCategories` from `./supabase` per the existing file).

- [ ] **Step 1.5: Run the tests to verify they pass**

```bash
pnpm test:run tests/unit/lib/excel.test.ts
```

Expected: PASS — 24 tests total (16 pre-existing + 5 new for tents + 3 new for categories). All green.

- [ ] **Step 1.6: Run full suite + type-check + lint**

```bash
pnpm test:run
pnpm type-check
pnpm lint
```

Expected: full suite 195 tests (187 pre-T1 baseline + 8 new). Type-check clean. Lint at 12-error baseline (no new errors).

- [ ] **Step 1.7: Commit**

```bash
git add src/lib/excel.ts tests/unit/lib/excel.test.ts
git commit -m "$(cat <<'EOF'
feat(lib): exportTentsToBlob + exportCategoriesToBlob

Pure SheetJS-backed helpers that build round-trip-friendly .xlsx
workbooks for the current event's tents and categories. Tent columns
mirror the import wizard's RawRow shape exactly; categories sort by
display_order. Empty cells (not "null" strings) for missing values.
EOF
)"
```

---

## Task 2 — Export button on `TentListPage`

**Files:**
- Modify: `src/pages/admin/TentListPage.tsx`
- Modify: `src/locales/de/common.json`, `src/locales/en/common.json`

- [ ] **Step 2.1: Add the i18n key in both locales**

Open `src/locales/de/common.json`. Find the `admin.tent_list.*` block. Add `"export_xlsx": "↓ Excel-Export"` after `"csv_import"`:

```jsonc
"tent_list": {
  "heading": "{{title}} — Stände",
  "csv_import": "CSV-Import",
  "export_xlsx": "↓ Excel-Export",
  "new_tent": "+ Neuer Stand",
  // …rest unchanged…
}
```

Open `src/locales/en/common.json`. Same insertion in the matching block:

```jsonc
"tent_list": {
  "heading": "{{title}} — Tents",
  "csv_import": "CSV import",
  "export_xlsx": "↓ Export to Excel",
  "new_tent": "+ New tent",
  // …rest unchanged…
}
```

- [ ] **Step 2.2: Add the export handler and button to TentListPage**

Open `src/pages/admin/TentListPage.tsx`. Make these changes:

**Imports (add or extend the top of the file):**

```tsx
import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase, type Tent } from '../../lib/supabase';
import { useEvent } from '../../hooks/useEvent';
import { exportTentsToBlob } from '../../lib/excel';
import { flattenTentCategories } from '../../lib/tentCategories';
import { useToast } from '../../components/ToastProvider';
```

(The existing imports already cover most of this; you're adding `exportTentsToBlob`, `flattenTentCategories`, and `useToast`.)

**Inside the component, after the existing `useEvent` line, add a busy flag and toast hook:**

```tsx
const { event } = useEvent(eventSlug);
const [tents, setTents] = useState<Tent[]>([]);
const [exportBusy, setExportBusy] = useState(false);
const { showError } = useToast();
```

**Add the export handler ABOVE the existing `useEffect`:**

```tsx
async function handleExport() {
  if (!event) return;
  setExportBusy(true);
  try {
    const { data, error } = await supabase
      .from('tents')
      .select('*, tent_categories(category:categories(*))')
      .eq('event_id', event.id)
      .order('display_number', { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    const tentsWithCategories = flattenTentCategories((data ?? []) as never);
    const blob = exportTentsToBlob(tentsWithCategories);
    const today = new Date();
    const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const filename = `kunstmeile-${event.slug}-tents-${stamp}.xlsx`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'export failed';
    showError(`Export failed: ${msg}`);
  } finally {
    setExportBusy(false);
  }
}
```

**Add the Export button in the header `<div className="flex gap-2">`, BEFORE the existing CSV-Import link:**

```tsx
<div className="flex gap-2">
  <button
    type="button"
    onClick={handleExport}
    disabled={exportBusy}
    className="rounded bg-white/10 px-3 py-1 text-sm disabled:opacity-50"
  >
    {t('admin.tent_list.export_xlsx')}
  </button>
  <Link
    to={`/admin/events/${event.slug}/tents/import`}
    className="rounded bg-white/10 px-3 py-1 text-sm"
  >
    {t('admin.tent_list.csv_import')}
  </Link>
  <Link
    to={`/admin/events/${event.slug}/tents/new`}
    className="rounded bg-white/20 px-3 py-1 text-sm"
  >
    {t('admin.tent_list.new_tent')}
  </Link>
</div>
```

The existing `useEffect` that fetches `tents` for the table display stays unchanged — it loads a flat `Tent[]` for the list rendering. The export does its own one-off fetch with the categories join. Two reads on click is fine for an admin-only rare action.

- [ ] **Step 2.3: Run the existing TentListPage test to ensure no regression**

```bash
pnpm test:run tests/unit/pages/admin/TentListPage.test.tsx
```

Expected: PASS — the existing tests assert on table content (sample tents rendered, headings, etc.) and don't interact with the new button. If a test breaks because the `<div className="flex gap-2">` now has 3 children instead of 2, adjust the affected assertion to be more specific (e.g., search by role + accessible name).

- [ ] **Step 2.4: Run full suite + type-check + lint**

```bash
pnpm test:run
pnpm type-check
pnpm lint
```

Expected: 195 tests (or 195+ if the existing TentListPage test happens to add one for the new button — not required). Type-check clean. Lint baseline preserved.

- [ ] **Step 2.5: Commit**

```bash
git add src/pages/admin/TentListPage.tsx src/locales/de/common.json src/locales/en/common.json
git commit -m "feat(admin): Excel-Export button on TentListPage"
```

---

## Task 3 — Export button on `CategoryListPage`

**Files:**
- Modify: `src/pages/admin/CategoryListPage.tsx`
- Modify: `src/locales/de/common.json`, `src/locales/en/common.json`

- [ ] **Step 3.1: Add the i18n key in both locales**

Open `src/locales/de/common.json`. Find the `admin.category.*` block. Add `"export_xlsx"` after `"new"`:

```jsonc
"category": {
  "heading": "Kategorien — {{title}}",
  "new": "+ Neue Kategorie",
  "export_xlsx": "↓ Excel-Export",
  // …rest unchanged…
}
```

Open `src/locales/en/common.json`. Mirror:

```jsonc
"category": {
  "heading": "Categories — {{title}}",
  "new": "+ New category",
  "export_xlsx": "↓ Export to Excel",
  // …rest unchanged…
}
```

- [ ] **Step 3.2: Add the export handler and button to CategoryListPage**

Open `src/pages/admin/CategoryListPage.tsx`. Make these changes:

**Extend the imports:**

```tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase, type Category } from '../../lib/supabase';
import { useEvent } from '../../hooks/useEvent';
import { exportCategoriesToBlob } from '../../lib/excel';
import { useToast } from '../../components/ToastProvider';
```

**Inside the component, add a busy flag and toast hook (alongside existing state):**

```tsx
const [exportBusy, setExportBusy] = useState(false);
const { showError } = useToast();
```

**Add the export handler near the other handlers (`resetDraft`, `onSubmit`, `confirmDelete`):**

```tsx
function handleExport() {
  if (!event) return;
  setExportBusy(true);
  try {
    const blob = exportCategoriesToBlob(categories);
    const today = new Date();
    const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const filename = `kunstmeile-${event.slug}-categories-${stamp}.xlsx`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'export failed';
    showError(`Export failed: ${msg}`);
  } finally {
    setExportBusy(false);
  }
}
```

> Note: `handleExport` is synchronous here (no async/await) because it reads from local `categories` state which is already populated. `try/catch` still guards against unexpected SheetJS errors. No supabase fetch happens.

**Add the Export button in the page header, alongside the existing "+ Neue Kategorie" button:**

Replace the existing header's right side with a 2-button group:

```tsx
<div className="flex gap-2">
  <button
    type="button"
    onClick={handleExport}
    disabled={exportBusy || categories.length === 0}
    className="rounded bg-white/10 px-3 py-1 text-sm disabled:opacity-50"
  >
    {t('admin.category.export_xlsx')}
  </button>
  {!showForm && (
    <button
      type="button"
      onClick={() => setShowForm(true)}
      className="rounded bg-white/20 px-3 py-1 text-sm"
    >
      {t('admin.category.new')}
    </button>
  )}
</div>
```

(The Export button stays visible while the form is open; that's intentional — admins might want to export before adding more categories. It's disabled when there's nothing to export.)

- [ ] **Step 3.3: Run the existing CategoryListPage test**

```bash
pnpm test:run tests/unit/pages/admin/CategoryListPage.test.tsx
```

Expected: PASS. If a test breaks because of the header restructure (e.g., querying for "+ Neue Kategorie" with `getByRole('button')` ambiguously matches two buttons now), tighten the assertion (use the accessible name or `getByRole('button', { name: /Neue Kategorie/i })`).

- [ ] **Step 3.4: Run full suite + type-check + lint**

```bash
pnpm test:run
pnpm type-check
pnpm lint
```

Expected: all green, baseline preserved.

- [ ] **Step 3.5: Commit**

```bash
git add src/pages/admin/CategoryListPage.tsx src/locales/de/common.json src/locales/en/common.json
git commit -m "feat(admin): Excel-Export button on CategoryListPage"
```

---

## Task 4 — Manual smoke checklist + push + PR

**Files:**
- Create: `tests/manual/excel-export-smoke.md`

- [ ] **Step 4.1: Write the manual smoke checklist**

Create `tests/manual/excel-export-smoke.md` with the following content:

```markdown
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
```

- [ ] **Step 4.2: Run final verification (full)**

```bash
pnpm test:run
pnpm type-check
pnpm lint
pnpm build
```

Expected: all clean.

- [ ] **Step 4.3: Commit**

```bash
git add tests/manual/excel-export-smoke.md
git commit -m "docs(manual): smoke checklist for Excel export"
```

- [ ] **Step 4.4: Push the branch and open a PR**

```bash
git push -u origin feat/excel-export
gh pr create --base main --head feat/excel-export --title "feat: Excel-Export for tents and categories" --body "$(cat <<'EOF'
## Summary
- Two new ".xlsx" download buttons in the admin: one on TentListPage, one on CategoryListPage.
- Stand export columns mirror the import wizard's RawRow shape — exported files are directly re-importable (round-trip-friendly).
- Categories export includes slug, name_de, name_en, icon, display_order (sorted by display_order).
- Filenames stamped with YYYY-MM-DD so multiple snapshots don't collide.

## Background
First of two follow-up features requested after the map pivot merged. The second (role management) is a separate spec/plan/PR. See [docs/superpowers/specs/2026-05-27-excel-export-design.md](docs/superpowers/specs/2026-05-27-excel-export-design.md).

## What's in this branch
- T1 \`feat(lib)\`: \`exportTentsToBlob\` + \`exportCategoriesToBlob\` in src/lib/excel.ts, 8 new unit tests.
- T2 \`feat(admin)\`: Excel-Export button on TentListPage with on-demand supabase fetch for the categories join.
- T3 \`feat(admin)\`: Excel-Export button on CategoryListPage (uses already-loaded local state).
- T4 \`docs(manual)\`: Smoke checklist.
- i18n: \`admin.tent_list.export_xlsx\` and \`admin.category.export_xlsx\` keys in DE and EN.

## Verification
- \`pnpm test:run\`: 195 tests passing (187 baseline + 8 new).
- \`pnpm type-check\`: clean.
- \`pnpm lint\`: 12-error baseline preserved.
- \`pnpm build\`: succeeds.

## Test plan
- [ ] [tests/manual/excel-export-smoke.md](tests/manual/excel-export-smoke.md) — Stände-Export, Kategorien-Export, round-trip, edge cases.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4.5: User manual smoke on the Vercel preview**

Pause. Wait for the user to run the smoke checklist against the preview. If anything fails, follow-up commits on the same branch (no new PR).

- [ ] **Step 4.6: Squash-merge and clean up**

After smoke passes, the user runs (or authorizes the controller to run):

```bash
git checkout main
gh pr merge <pr-number> --squash --delete-branch
git pull
```

---

## Self-Review

**Spec coverage (each EX-decision → which task implements it):**

- EX-001 (two separate .xlsx files, two buttons): T2 + T3.
- EX-002 (stands columns match import RawRow): T1 (`TENT_EXPORT_COLUMNS` constant) + tested in T1's header-row assertion.
- EX-003 (categories columns slug/name_de/name_en/icon/display_order): T1 (`CATEGORY_EXPORT_COLUMNS`) + tested.
- EX-004 (real display_number and slug, not nulls): T1's mapping reads `t.display_number` and `t.slug` directly, no auto-generation. Tested via the minimalTent fixture which has `display_number: 42` and `slug: 'galerie-mueller'`.
- EX-005 (empty cells stay empty, not "null"): T1's `cellValue` helper + the explicit test ("emits empty cells for null/undefined values").
- EX-006 (filename format `kunstmeile-<slug>-tents-YYYY-MM-DD.xlsx`): T2 and T3 build it inline in the click handler.
- EX-007 (button placement next to existing primary actions): T2 (button in the `flex gap-2` next to CSV-Import + Neuer Stand) and T3 (button next to + Neue Kategorie).
- EX-008 (no new deps): nothing added. SheetJS used via existing `xlsx` dependency.
- EX-009 (no schema changes): confirmed — only TS/JSX changes.
- EX-010 (i18n keys `admin.tent_list.export_xlsx`, `admin.category.export_xlsx`): T2 and T3 each add their key.
- Round-trip guarantee section: validated by the manual smoke step in T4 (edit a row, re-import, verify the change landed).

**Placeholder scan:** No "TBD" / "TODO" / "fill in" patterns. The two engineer notes (about the `./supabase` re-export verification and about the test brittleness if `<div className="flex gap-2">` child count breaks an assertion) are concrete guidance, not unspecified work.

**Type consistency:** `exportTentsToBlob(tents: TentWithCategories[])` and `exportCategoriesToBlob(categories: Category[])` are the same signatures in T1 (declaration), T2 (call site), and T3 (call site). The `Blob` return type is used uniformly. The `cellValue<T>` helper signature is consistent across both helpers.

No drift; implementation can proceed.
