import { describe, it, expect } from 'vitest';
import { flattenTentCategories } from '../../../src/lib/tentCategories';
import type { Category } from '../../../src/lib/supabase';

const galerie: Category = {
  id: '11111111-1111-1111-1111-111111111111',
  event_id: 'evt-1',
  slug: 'galerie',
  name_de: 'Galerie',
  name_en: 'Gallery',
  icon: '🎨',
  display_order: 1,
  created_at: '2026-01-01T00:00:00Z',
};
const atelier: Category = {
  ...galerie,
  id: '22222222-2222-2222-2222-222222222222',
  slug: 'atelier',
  name_de: 'Atelier',
  name_en: 'Studio',
  icon: '🖌️',
  display_order: 2,
};

describe('flattenTentCategories', () => {
  it('lifts categories array out of the join wrapper', () => {
    const raw = [
      {
        id: 't1',
        slug: 'a',
        name: 'A',
        display_number: 1,
        tent_categories: [{ category: galerie }, { category: atelier }],
      },
    ];
    const flat = flattenTentCategories(raw as never);
    expect(flat).toHaveLength(1);
    expect(flat[0]!.categories.map((c) => c.slug).sort()).toEqual(['atelier', 'galerie']);
    // Inner wrapper field is not on the result type.
    expect((flat[0]! as unknown as { tent_categories?: unknown }).tent_categories).toBeUndefined();
  });

  it('returns an empty categories array for tents with no joins', () => {
    const raw = [{ id: 't2', slug: 'b', name: 'B', display_number: 2, tent_categories: [] }];
    const flat = flattenTentCategories(raw as never);
    expect(flat[0]!.categories).toEqual([]);
  });

  it('drops null categories defensively (e.g. ON DELETE SET NULL — should not happen given our cascade)', () => {
    const raw = [
      {
        id: 't3',
        slug: 'c',
        name: 'C',
        display_number: 3,
        tent_categories: [{ category: null }, { category: galerie }],
      },
    ];
    const flat = flattenTentCategories(raw as never);
    expect(flat[0]!.categories).toEqual([galerie]);
  });
});
