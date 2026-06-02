import { describe, it, expect, vi, beforeEach } from 'vitest';
import JSZip from 'jszip';
import type { Event } from '../../../src/lib/supabase';

// --- Supabase mock: tents query + per-tent photos query ----------------------
const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock('../../../src/lib/supabase', () => ({
  supabase: {
    from: fromMock,
    storage: {
      from: () => ({
        getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn/${p}` } }),
      }),
    },
  },
}));

import { buildEventZip } from '../../../src/lib/exportEvent';

const event = {
  id: 'evt-1',
  slug: 'kunstmeile-2026',
  title_de: 'Kunstmeile 2026',
  title_en: null,
  year: 2026,
  starts_at: '2026-05-01',
  ends_at: '2026-05-03',
  venue_name: 'Hafen',
  venue_address: null,
} as unknown as Event;

function mockTentsQuery() {
  return {
    select: () => ({
      eq: () => ({
        order: () =>
          Promise.resolve({
            data: [
              { id: 't1', slug: 'galerie', name: 'Galerie', display_number: 1, tent_categories: [] },
            ],
            error: null,
          }),
      }),
    }),
  };
}

function mockPhotosQuery() {
  return {
    select: () => ({
      eq: () => ({
        order: () =>
          Promise.resolve({
            data: [
              { storage_path: 'evt-1/t1/a.jpg', display_order: 0 },
              { storage_path: 'evt-1/t1/b.png', display_order: 1 },
            ],
          }),
      }),
    }),
  };
}

describe('buildEventZip', () => {
  beforeEach(() => {
    fromMock.mockReset();
    fromMock.mockImplementation((table: string) =>
      table === 'tents' ? mockTentsQuery() : mockPhotosQuery(),
    );
  });

  it('assembles a zip with overview, per-tent page, and downloaded photos; skips failed fetches', async () => {
    // First photo succeeds, second 404s → skipped.
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('a.jpg')) {
        return { ok: true, blob: async () => new Blob(['img-a']) } as unknown as Response;
      }
      return { ok: false, status: 404, blob: async () => new Blob([]) } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const progress: Array<{ done: number; total: number }> = [];
    const result = await buildEventZip(event, { onProgress: (p) => progress.push(p) });

    expect(result.tentCount).toBe(1);
    expect(result.photoCount).toBe(2);
    expect(result.skipped).toEqual(['1_galerie/1_galerie_photo_02.png']);
    // progress reported, ending at done === total
    expect(progress.at(-1)).toEqual({ done: 2, total: 2 });

    const zip = await JSZip.loadAsync(result.blob);
    expect(zip.file('index.html')).not.toBeNull();
    expect(zip.file('1_galerie/index.html')).not.toBeNull();
    expect(zip.file('1_galerie/1_galerie_photo_01.jpg')).not.toBeNull();
    // The failed photo is NOT in the zip.
    expect(zip.file('1_galerie/1_galerie_photo_02.png')).toBeNull();

    const overview = await zip.file('index.html')!.async('string');
    expect(overview).toContain('href="1_galerie/index.html"');

    vi.unstubAllGlobals();
  });
});
