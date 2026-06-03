import { z } from 'zod';
import * as XLSX from 'xlsx';
import { isValidCoord } from './map';
import type { Category, TentWithCategories } from './supabase';

/**
 * Helpers for the admin bulk-import wizard. Pure functions only — no
 * SheetJS / PapaParse imports here so this stays unit-testable in jsdom
 * without bringing in the parsers. The wizard component (TentImportPage)
 * owns the actual file parsing and wires the rows into validateRow().
 */

export type Parser = 'csv' | 'xlsx';

export function parserForFilename(name: string): Parser | null {
  const lower = name.toLowerCase();
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.xlsx')) return 'xlsx';
  return null;
}

/**
 * Header aliases — keys are the canonical RawRow field names; values are
 * alternative spellings admins may have in their spreadsheets. Used by
 * `pickAlias` to read an input row case-insensitively without forcing the
 * operator to rename their German columns.
 */
export const HEADER_ALIASES: Record<string, readonly string[]> = {
  contact_person: ['ansprechperson', 'contact person', 'contact_person'],
};

export function pickAlias(input: Record<string, unknown>, canonical: string): unknown {
  if (input[canonical] != null && input[canonical] !== '') return input[canonical];
  const aliases = HEADER_ALIASES[canonical];
  if (!aliases) return input[canonical];
  const lowerKeys = Object.keys(input).reduce<Record<string, string>>((acc, k) => {
    acc[k.toLowerCase()] = k;
    return acc;
  }, {});
  for (const alias of aliases) {
    const actualKey = lowerKeys[alias.toLowerCase()];
    if (actualKey != null && input[actualKey] != null && input[actualKey] !== '') {
      return input[actualKey];
    }
  }
  return input[canonical];
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    // Strip remaining Latin diacritics (é → e, à → a, ñ → n, …) so they're
    // preserved as the base letter rather than collapsed to a dash.
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function generateUniqueSlug(
  name: string,
  existing: string[] | Set<string>,
): string {
  const set = existing instanceof Set ? existing : new Set(existing);
  const base = slugify(name) || 'tent';
  if (!set.has(base)) return base;
  let i = 2;
  while (set.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

export interface RawRow {
  name?: string;
  contact_person?: string;
  display_number?: string;
  slug?: string;
  category_slugs?: string;
  description_de?: string;
  description_en?: string;
  address?: string;
  website_url?: string;
  instagram_url?: string;
  facebook_url?: string;
  email_public?: string;
  lat?: string;
  lng?: string;
}

export interface ParsedRow {
  name: string;
  contact_person: string | null;
  display_number: number;
  slug: string;
  category_slugs: string[];
  description_de: string | null;
  description_en: string | null;
  address: string | null;
  website_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  email_public: string | null;
  lat: number | null;
  lng: number | null;
}

export interface ValidateCtx {
  knownCategorySlugs: Set<string>;
  existingDisplayNumbers: Set<number>;
  existingSlugs: Set<string>;
  rowIndex: number;
}

export interface RowResult {
  status: 'ok' | 'warning' | 'error';
  parsed?: ParsedRow;
  warnings?: string[];
  errors?: string[];
}

// zod 4: z.url() is RFC-strict; mirror the TentEditForm pattern so blank
// values are accepted as "no link given".
const UrlOrBlank = z.url().optional().or(z.literal(''));
const EmailOrBlank = z.email().optional().or(z.literal(''));

export function validateRow(row: RawRow, ctx: ValidateCtx): RowResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const name = (row.name ?? '').trim();
  if (!name) errors.push('name is required');

  const displayNumberRaw = (row.display_number ?? '').trim();
  const displayNumber = displayNumberRaw
    ? Number.parseInt(displayNumberRaw, 10)
    : Number.NaN;
  if (!Number.isFinite(displayNumber) || displayNumber <= 0) {
    errors.push('display_number must be a positive integer');
  } else if (ctx.existingDisplayNumbers.has(displayNumber)) {
    errors.push(`display_number ${displayNumber} is duplicated`);
  }

  const slugRaw = (row.slug ?? '').trim();
  const slug = slugRaw || generateUniqueSlug(name || 'tent', ctx.existingSlugs);
  if (slugRaw && ctx.existingSlugs.has(slugRaw)) {
    errors.push(`slug "${slugRaw}" is duplicated`);
  }

  const categorySlugsRaw = (row.category_slugs ?? '').trim();
  const categorySlugs = categorySlugsRaw
    ? categorySlugsRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const unknown = categorySlugs.filter((s) => !ctx.knownCategorySlugs.has(s));
  if (unknown.length > 0) {
    warnings.push(`unknown category slugs skipped: ${unknown.join(', ')}`);
  }
  const validCategorySlugs = categorySlugs.filter((s) =>
    ctx.knownCategorySlugs.has(s),
  );

  for (const [key, raw] of [
    ['website_url', row.website_url],
    ['instagram_url', row.instagram_url],
    ['facebook_url', row.facebook_url],
  ] as const) {
    const parseResult = UrlOrBlank.safeParse((raw ?? '').trim());
    if (!parseResult.success) errors.push(`${key} is not a valid URL`);
  }
  const emailResult = EmailOrBlank.safeParse((row.email_public ?? '').trim());
  if (!emailResult.success) errors.push('email_public is not a valid email');

  const latRaw = (row.lat ?? '').trim();
  const lngRaw = (row.lng ?? '').trim();
  let lat: number | null = null;
  let lng: number | null = null;
  if (latRaw === '' && lngRaw === '') {
    // both blank — coords stay null, allowed
  } else if (latRaw === '' || lngRaw === '') {
    errors.push('lat and lng must both be set or both be empty');
  } else {
    lat = Number(latRaw);
    lng = Number(lngRaw);
    if (!isValidCoord(lat, lng)) errors.push('lat/lng out of range');
  }

  if (errors.length > 0) return { status: 'error', errors };

  const parsed: ParsedRow = {
    name,
    contact_person: row.contact_person?.trim() || null,
    display_number: displayNumber,
    slug,
    category_slugs: validCategorySlugs,
    description_de: row.description_de?.trim() || null,
    description_en: row.description_en?.trim() || null,
    address: row.address?.trim() || null,
    website_url: row.website_url?.trim() || null,
    instagram_url: row.instagram_url?.trim() || null,
    facebook_url: row.facebook_url?.trim() || null,
    email_public: row.email_public?.trim() || null,
    lat,
    lng,
  };
  if (warnings.length > 0) return { status: 'warning', parsed, warnings };
  return { status: 'ok', parsed };
}

const TENT_EXPORT_COLUMNS = [
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
] as const;

const CATEGORY_EXPORT_COLUMNS = [
  'slug',
  'name_de',
  'name_en',
  'icon',
  'color',
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
    cellValue(t.contact_person),
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
 * Canonical → alias header map for the category import. Keys are the canonical
 * column names exactly as written by `exportCategoriesToBlob`; values are
 * additional spellings (German, spaced) admins might keep in their files.
 * Matching is case-insensitive.
 */
export const CATEGORY_HEADER_ALIASES: Record<string, readonly string[]> = {
  slug: ['slug'],
  name_de: ['name_de', 'name de', 'name (de)'],
  name_en: ['name_en', 'name en', 'name (en)'],
  icon: ['icon'],
  color: ['color', 'farbe'],
  display_order: ['display_order', 'reihenfolge', 'order'],
};

export interface ParsedCategoryRow {
  rowNumber: number;
  slug: string;
  name_de: string;
  name_en: string | null;
  icon: string;
  color: string | null;
  display_order: number;
  errors: string[];
}

/** Canonical 6-digit `#rrggbb` hex check for imported color cells. */
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export interface CategoryParseResult {
  rows: ParsedCategoryRow[];
  fatalError: string | null;
}

/** Build a lower-cased alias → canonical-key lookup from the alias config. */
function buildCategoryAliasLookup(): Record<string, string> {
  const lookup: Record<string, string> = {};
  for (const [canonical, aliases] of Object.entries(CATEGORY_HEADER_ALIASES)) {
    lookup[canonical.toLowerCase()] = canonical;
    for (const alias of aliases) {
      lookup[alias.toLowerCase()] = canonical;
    }
  }
  return lookup;
}

function coerceCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

const SLUG_RE = /^[a-z0-9-]+$/;

/**
 * Parse a CSV/XLSX file of category rows. Header recognition is case-insensitive
 * and accepts both the canonical export columns and the localised aliases listed
 * in CATEGORY_HEADER_ALIASES.
 *
 * Returns:
 * - `rows`: one ParsedCategoryRow per data row, in file order, with per-row errors.
 * - `fatalError`: a non-null string when the file as a whole can't be processed
 *   (no header row, no recognisable columns, parser/read failure).
 */
export async function parseCategoriesFromBlob(
  file: File,
): Promise<CategoryParseResult> {
  const parser = parserForFilename(file.name);
  if (!parser) {
    return { rows: [], fatalError: 'unsupported file type' };
  }

  let aoa: unknown[][];
  try {
    if (parser === 'csv') {
      const text = await file.text();
      const wb = XLSX.read(text, { type: 'string' });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) return { rows: [], fatalError: 'empty workbook' };
      const ws = wb.Sheets[sheetName];
      if (!ws) return { rows: [], fatalError: 'empty workbook' };
      aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
    } else {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) return { rows: [], fatalError: 'empty workbook' };
      const ws = wb.Sheets[sheetName];
      if (!ws) return { rows: [], fatalError: 'empty workbook' };
      aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'parse failed';
    return { rows: [], fatalError: msg };
  }

  if (aoa.length === 0) {
    return { rows: [], fatalError: 'no header row' };
  }

  const headerRow = aoa[0] ?? [];
  const aliasLookup = buildCategoryAliasLookup();
  // canonicalKey → column index in the data rows
  const columnIndex: Record<string, number> = {};
  headerRow.forEach((cell, idx) => {
    const key = coerceCell(cell).trim().toLowerCase();
    if (!key) return;
    const canonical = aliasLookup[key];
    if (canonical && !(canonical in columnIndex)) {
      columnIndex[canonical] = idx;
    }
  });

  // Require at least one recognised column to consider the header row valid.
  if (Object.keys(columnIndex).length === 0) {
    return { rows: [], fatalError: 'no header row' };
  }

  function read(row: unknown[], canonical: string): string {
    const idx = columnIndex[canonical];
    if (idx === undefined) return '';
    return coerceCell(row[idx]).trim();
  }

  const rows: ParsedCategoryRow[] = [];
  for (let i = 1; i < aoa.length; i++) {
    const raw = aoa[i] ?? [];
    // Skip wholly-empty rows so trailing blanks don't show up as errors.
    const isAllEmpty = (Object.keys(columnIndex) as string[]).every(
      (k) => read(raw, k) === '',
    );
    if (isAllEmpty) continue;

    const errors: string[] = [];
    const slug = read(raw, 'slug');
    const name_de = read(raw, 'name_de');
    const name_en_raw = read(raw, 'name_en');
    const icon = read(raw, 'icon');
    const colorRaw = read(raw, 'color');
    const orderRaw = read(raw, 'display_order');

    if (!slug) {
      errors.push('slug is required');
    } else if (!SLUG_RE.test(slug)) {
      errors.push('slug must match [a-z0-9-]+');
    }
    if (!name_de) errors.push('name_de is required');

    let color: string | null = null;
    if (colorRaw !== '') {
      if (HEX_COLOR_RE.test(colorRaw)) {
        color = colorRaw;
      } else {
        errors.push('color must be a hex value like #e57373');
      }
    }

    let display_order = 0;
    if (orderRaw === '') {
      // Default missing order to 0 — admins might omit it for fresh imports.
      display_order = 0;
    } else {
      const n = Number(orderRaw);
      if (!Number.isInteger(n)) {
        errors.push('display_order must be an integer');
      } else {
        display_order = n;
      }
    }

    rows.push({
      rowNumber: i + 1,
      slug,
      name_de,
      name_en: name_en_raw === '' ? null : name_en_raw,
      icon: icon || '✨',
      color,
      display_order,
      errors,
    });
  }

  if (rows.length === 0) {
    return { rows: [], fatalError: null };
  }

  return { rows, fatalError: null };
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
    cellValue(c.color),
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
