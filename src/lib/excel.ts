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
