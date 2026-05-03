import { describe, it, expect } from 'vitest';
import { selectVisibleMarkers } from '../../../src/lib/markers';
import type { TentWithCategories } from '../../../src/lib/supabase';

function tent(
  id: string,
  categoryIds: string[],
  position: { x: number; y: number; z: number } | null = { x: 0, y: 0, z: 0 },
  display_number: number | null = null,
): TentWithCategories {
  return {
    id,
    slug: `tent-${id}`,
    event_id: 'evt-1',
    name: `Tent ${id}`,
    description_de: '',
    description_en: '',
    address: null,
    website_url: null,
    instagram_url: null,
    facebook_url: null,
    position: position as unknown as TentWithCategories['position'],
    display_number,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    categories: categoryIds.map((cid) => ({
      id: cid,
      event_id: 'evt-1',
      name_de: cid,
      name_en: cid,
      icon: null,
      sort_order: 0,
      created_at: '2026-01-01T00:00:00Z',
    })),
  } as unknown as TentWithCategories;
}

describe('selectVisibleMarkers', () => {
  it('returns one marker per tent with a valid {x,y,z} position when no filter is active', () => {
    const tents = [tent('a', ['c1']), tent('b', ['c2'])];
    const out = selectVisibleMarkers(tents, new Set(), null);
    expect(out.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('skips tents whose position is not a valid {x,y,z}', () => {
    const tents = [tent('a', ['c1']), tent('b', ['c2'], null)];
    const out = selectVisibleMarkers(tents, new Set(), null);
    expect(out.map((m) => m.id)).toEqual(['a']);
  });

  it('keeps only matching tents when a filter is active (OR-semantics across selected categories)', () => {
    const tents = [tent('a', ['c1']), tent('b', ['c2']), tent('c', ['c1', 'c3'])];
    const out = selectVisibleMarkers(tents, new Set(['c1']), null);
    expect(out.map((m) => m.id).sort()).toEqual(['a', 'c']);
  });

  it('keeps the currently selected tent visible even when the active filter would exclude it', () => {
    const tents = [tent('a', ['c1']), tent('b', ['c2'])];
    const out = selectVisibleMarkers(tents, new Set(['c1']), 'b');
    expect(out.map((m) => m.id).sort()).toEqual(['a', 'b']);
  });

  it('uses display_number as the marker label when present, otherwise null', () => {
    const tents = [tent('a', ['c1'], { x: 0, y: 0, z: 0 }, 7), tent('b', ['c1'])];
    const out = selectVisibleMarkers(tents, new Set(), null);
    expect(out.find((m) => m.id === 'a')?.label).toBe('7');
    expect(out.find((m) => m.id === 'b')?.label).toBeNull();
  });
});
