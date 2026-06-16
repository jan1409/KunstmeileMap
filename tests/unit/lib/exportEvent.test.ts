import { describe, it, expect } from 'vitest';
import {
  tentFolderName,
  photoFileName,
  extFromStoragePath,
  renderTentPageHtml,
  renderOverviewHtml,
  type ExportTent,
} from '../../../src/lib/exportEvent';
import type { Event } from '../../../src/lib/supabase';

const event = {
  id: 'evt-1',
  slug: 'kunstmeile-2026',
  title_de: 'Kunstmeile 2026',
  title_en: 'Art Mile 2026',
  year: 2026,
  starts_at: '2026-05-01',
  ends_at: '2026-05-03',
  venue_name: 'Hafen',
  venue_address: 'Hafenstr. 1',
  status: 'published',
  is_featured: true,
  default_lat: 53.2,
  default_lng: 9.5,
  default_zoom: 18,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
} as unknown as Event;

function makeTent(overrides: Partial<ExportTent> = {}): ExportTent {
  return {
    id: 't1',
    slug: 'galerie-nord',
    name: 'Galerie Nord',
    display_number: 3,
    contact_person: null,
    description_de: null,
    description_en: null,
    address: null,
    website_url: null,
    instagram_url: null,
    facebook_url: null,
    email_public: null,
    phone: null,
    lat: null,
    lng: null,
    categories: [],
    ...overrides,
  } as ExportTent;
}

describe('tentFolderName', () => {
  it('joins display number and slug', () => {
    expect(tentFolderName(makeTent({ display_number: 3, slug: 'galerie-nord' }))).toBe(
      '3_galerie-nord',
    );
  });

  it('uses "x" when the display number is null', () => {
    expect(tentFolderName(makeTent({ display_number: null, slug: 'imbiss' }))).toBe(
      'x_imbiss',
    );
  });
});

describe('photoFileName', () => {
  it('prefixes with the folder name and zero-pads the index', () => {
    const t = makeTent({ display_number: 3, slug: 'galerie-nord' });
    expect(photoFileName(t, 0, 'jpg')).toBe('3_galerie-nord_photo_01.jpg');
    expect(photoFileName(t, 9, 'png')).toBe('3_galerie-nord_photo_10.png');
  });
});

describe('extFromStoragePath', () => {
  it('extracts the lowercased extension', () => {
    expect(extFromStoragePath('e1/t1/abc.JPG')).toBe('jpg');
    expect(extFromStoragePath('e1/t1/abc.png')).toBe('png');
  });
  it('falls back to jpg when no extension is present', () => {
    expect(extFromStoragePath('e1/t1/abc')).toBe('jpg');
  });
});

describe('renderTentPageHtml', () => {
  it('includes both DE and EN descriptions and core fields', () => {
    const html = renderTentPageHtml(
      makeTent({
        description_de: 'Deutsche Beschreibung',
        description_en: 'English description',
        address: 'Hafenstr. 5',
        website_url: 'https://example.com',
        categories: [
          { id: 'c1', slug: 'art', name_de: 'Kunst', name_en: 'Art' } as never,
        ],
      }),
      event,
      ['3_galerie-nord_photo_01.jpg'],
    );
    expect(html).toContain('Galerie Nord');
    expect(html).toContain('Deutsche Beschreibung');
    expect(html).toContain('English description');
    expect(html).toContain('Hafenstr. 5');
    expect(html).toContain('https://example.com');
    expect(html).toContain('Kunst');
    // gallery links the local photo file
    expect(html).toContain('3_galerie-nord_photo_01.jpg');
    expect(html.trim().toLowerCase().startsWith('<!doctype html>')).toBe(true);
  });

  it('includes the internal phone number (admins distribute the HTML export)', () => {
    const html = renderTentPageHtml(
      makeTent({ phone: '+49 4141 123456' }),
      event,
      [],
    );
    expect(html).toContain('Telefon');
    expect(html).toContain('+49 4141 123456');
  });

  it('omits the phone field entirely when not set', () => {
    const html = renderTentPageHtml(makeTent({ phone: null }), event, []);
    expect(html).not.toContain('Telefon');
  });

  it('escapes HTML in user-provided text to prevent broken markup', () => {
    const html = renderTentPageHtml(
      makeTent({ name: 'A & B <script>alert(1)</script>' }),
      event,
      [],
    );
    expect(html).toContain('A &amp; B &lt;script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});

describe('renderOverviewHtml', () => {
  it('lists each tent and links to its subfolder index.html', () => {
    const html = renderOverviewHtml(event, [
      { tent: makeTent({ display_number: 3, slug: 'galerie-nord', name: 'Galerie Nord' }), folderName: '3_galerie-nord' },
      { tent: makeTent({ id: 't2', display_number: 4, slug: 'imbiss', name: 'Imbiss' }), folderName: '4_imbiss' },
    ]);
    expect(html).toContain('Kunstmeile 2026');
    expect(html).toContain('href="3_galerie-nord/index.html"');
    expect(html).toContain('href="4_imbiss/index.html"');
    expect(html).toContain('Galerie Nord');
    expect(html).toContain('Imbiss');
  });
});
