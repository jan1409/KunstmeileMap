import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  validateRow,
  generateUniqueSlug,
  parserForFilename,
  pickAlias,
  slugify,
  exportTentsToBlob,
  exportCategoriesToBlob,
} from '../../../src/lib/excel';

describe('parserForFilename', () => {
  it('returns "csv" for .csv files', () => {
    expect(parserForFilename('tents.csv')).toBe('csv');
    expect(parserForFilename('TENTS.CSV')).toBe('csv');
  });
  it('returns "xlsx" for .xlsx files', () => {
    expect(parserForFilename('tents.xlsx')).toBe('xlsx');
  });
  it('returns null for unknown extensions', () => {
    expect(parserForFilename('tents.ods')).toBeNull();
    expect(parserForFilename('tents')).toBeNull();
  });
});

describe('slugify', () => {
  it('converts German umlauts and punctuation', () => {
    expect(slugify('Galerie Müller')).toBe('galerie-mueller');
    expect(slugify('Café & Bar')).toBe('cafe-bar');
  });
  it('strips leading/trailing dashes', () => {
    expect(slugify('  Hello World  ')).toBe('hello-world');
  });
});

describe('generateUniqueSlug', () => {
  it('slugifies a name', () => {
    expect(generateUniqueSlug('Galerie Müller', [])).toBe('galerie-mueller');
  });
  it('appends -2 if taken', () => {
    expect(generateUniqueSlug('Galerie Müller', ['galerie-mueller'])).toBe(
      'galerie-mueller-2',
    );
  });
  it('keeps incrementing until unique', () => {
    expect(
      generateUniqueSlug('Galerie Müller', [
        'galerie-mueller',
        'galerie-mueller-2',
      ]),
    ).toBe('galerie-mueller-3');
  });
});

describe('validateRow', () => {
  const validRow = {
    name: 'Stand 1',
    display_number: '42',
    slug: '',
    category_slugs: 'painting',
    description_de: '',
    description_en: '',
    address: '',
    website_url: '',
    instagram_url: '',
    facebook_url: '',
    email_public: '',
    lat: '',
    lng: '',
  };

  const ctx = {
    knownCategorySlugs: new Set(['painting', 'sculpture']),
    existingDisplayNumbers: new Set<number>(),
    existingSlugs: new Set<string>(),
    rowIndex: 1,
  };

  it('accepts a minimal valid row', () => {
    const r = validateRow(validRow, ctx);
    expect(r.status).toBe('ok');
    expect(r.parsed?.display_number).toBe(42);
  });

  it('fails when name is missing', () => {
    const r = validateRow({ ...validRow, name: '' }, ctx);
    expect(r.status).toBe('error');
    expect(r.errors).toContain('name is required');
  });

  it('fails on duplicate display_number within the import', () => {
    const r = validateRow(validRow, {
      ...ctx,
      existingDisplayNumbers: new Set([42]),
    });
    expect(r.status).toBe('error');
    expect(r.errors?.some((e) => e.includes('display_number'))).toBe(true);
  });

  it('warns on unknown category slugs', () => {
    const r = validateRow(
      { ...validRow, category_slugs: 'painting,voodoo' },
      ctx,
    );
    expect(r.status).toBe('warning');
    expect(r.warnings?.some((w) => w.includes('voodoo'))).toBe(true);
  });

  it('accepts valid lat/lng', () => {
    const r = validateRow({ ...validRow, lat: '49.0', lng: '8.4' }, ctx);
    expect(r.status).toBe('ok');
    expect(r.parsed?.lat).toBe(49.0);
    expect(r.parsed?.lng).toBe(8.4);
  });

  it('rejects lat out of range', () => {
    const r = validateRow({ ...validRow, lat: '91', lng: '8.4' }, ctx);
    expect(r.status).toBe('error');
  });

  it('rejects only-one-of-lat/lng', () => {
    const r = validateRow({ ...validRow, lat: '49.0', lng: '' }, ctx);
    expect(r.status).toBe('error');
  });

  it('rejects invalid URL', () => {
    const r = validateRow({ ...validRow, website_url: 'not-a-url' }, ctx);
    expect(r.status).toBe('error');
  });
});

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

  it('produces the 14-column header row in the expected order', async () => {
    const blob = exportTentsToBlob([minimalTent] as never);
    const aoa = await readBlobAsAoa(blob);
    expect(aoa[0]).toEqual([
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
    ]);
  });

  it('serializes a tent with its category slugs comma-joined', async () => {
    const blob = exportTentsToBlob([
      { ...minimalTent, contact_person: 'Anna Müller' },
    ] as never);
    const aoa = await readBlobAsAoa(blob);
    const row = aoa[1]!;
    expect(row[0]).toBe('Galerie Müller');
    expect(row[1]).toBe('Anna Müller');
    expect(row[2]).toBe(42);
    expect(row[3]).toBe('galerie-mueller');
    expect(row[4]).toBe('painting,sculpture');
    expect(row[12]).toBe(49.0);
    expect(row[13]).toBe(8.4);
  });

  it('emits empty cells for null/undefined values', async () => {
    const sparseTent = {
      ...minimalTent,
      contact_person: null,
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
    expect(row[1] === '' || row[1] === undefined).toBe(true); // contact_person
    expect(row[2] === '' || row[2] === undefined).toBe(true); // display_number
    expect(row[4] === '' || row[4] === undefined).toBe(true); // category_slugs
    expect(row[12] === '' || row[12] === undefined).toBe(true); // lat
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
    expect(aoa[0]).toHaveLength(14);
  });
});

describe('pickAlias', () => {
  it('returns the canonical key value when present', () => {
    const v = pickAlias({ contact_person: 'Anna' }, 'contact_person');
    expect(v).toBe('Anna');
  });

  it('matches "Ansprechperson" (DE) case-insensitively', () => {
    expect(pickAlias({ Ansprechperson: 'Anna' }, 'contact_person')).toBe('Anna');
    expect(pickAlias({ ansprechperson: 'Anna' }, 'contact_person')).toBe('Anna');
    expect(pickAlias({ ANSPRECHPERSON: 'Anna' }, 'contact_person')).toBe('Anna');
  });

  it('matches "Contact Person" (EN with space)', () => {
    expect(pickAlias({ 'Contact Person': 'Anna' }, 'contact_person')).toBe('Anna');
  });

  it('prefers the canonical key over an alias when both are present', () => {
    const v = pickAlias(
      { contact_person: 'Canonical', Ansprechperson: 'Alias' },
      'contact_person',
    );
    expect(v).toBe('Canonical');
  });

  it('returns the canonical-key value (which may be undefined) when nothing matches', () => {
    expect(pickAlias({ name: 'X' }, 'contact_person')).toBeUndefined();
  });
});

describe('validateRow with contact_person', () => {
  const baseRow = {
    name: 'Stand 1',
    display_number: '42',
    slug: '',
    category_slugs: '',
    description_de: '',
    description_en: '',
    address: '',
    website_url: '',
    instagram_url: '',
    facebook_url: '',
    email_public: '',
    lat: '',
    lng: '',
  };

  const ctx = {
    knownCategorySlugs: new Set<string>(),
    existingDisplayNumbers: new Set<number>(),
    existingSlugs: new Set<string>(),
    rowIndex: 1,
  };

  it('parses a trimmed contact_person value', () => {
    const r = validateRow({ ...baseRow, contact_person: '  Anna Müller  ' }, ctx);
    expect(r.status).toBe('ok');
    expect(r.parsed?.contact_person).toBe('Anna Müller');
  });

  it('emits null for blank contact_person', () => {
    const r = validateRow(baseRow, ctx);
    expect(r.status).toBe('ok');
    expect(r.parsed?.contact_person).toBeNull();
  });
});

describe('exportCategoriesToBlob', () => {
  const cat = (overrides: Partial<{ id: string; slug: string; name_de: string; name_en: string | null; icon: string | null; display_order: number }> = {}) => ({
    id: overrides.id ?? 'c-id',
    event_id: 'e1',
    slug: overrides.slug ?? 'painting',
    name_de: overrides.name_de ?? 'Malerei',
    // Use `in` check so explicitly-passed `null` overrides survive (??
    // would fall through to the default for null).
    name_en: 'name_en' in overrides ? overrides.name_en : 'Painting',
    icon: 'icon' in overrides ? overrides.icon : '🎨',
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
