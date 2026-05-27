import { describe, expect, it } from 'vitest';
import {
  validateRow,
  generateUniqueSlug,
  parserForFilename,
  slugify,
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
