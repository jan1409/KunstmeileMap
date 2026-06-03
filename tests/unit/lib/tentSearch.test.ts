import { describe, it, expect } from 'vitest';
import { filterTents } from '../../../src/lib/tentSearch';
import type { Tent } from '../../../src/lib/supabase';

function tent(name: string, contact_person: string | null = null): Tent {
  return { id: name, name, contact_person } as unknown as Tent;
}

const tents = [
  tent('Galerie Müller', 'Anna Schmidt'),
  tent('Café Bergs', null),
  tent('Keramik Studio', 'Bernd Weber'),
];

describe('filterTents', () => {
  it('matches by tent name (case-insensitive substring)', () => {
    expect(filterTents(tents, 'café').map((t) => t.name)).toEqual(['Café Bergs']);
    expect(filterTents(tents, 'GALERIE').map((t) => t.name)).toEqual([
      'Galerie Müller',
    ]);
  });

  it('matches by contact person', () => {
    expect(filterTents(tents, 'bernd').map((t) => t.name)).toEqual([
      'Keramik Studio',
    ]);
    expect(filterTents(tents, 'schmidt').map((t) => t.name)).toEqual([
      'Galerie Müller',
    ]);
  });

  it('handles a null contact person without throwing', () => {
    expect(filterTents(tents, 'bergs').map((t) => t.name)).toEqual([
      'Café Bergs',
    ]);
  });

  it('returns an empty array for an empty or whitespace query', () => {
    expect(filterTents(tents, '')).toEqual([]);
    expect(filterTents(tents, '   ')).toEqual([]);
  });

  it('respects the result limit', () => {
    const many = Array.from({ length: 20 }, (_, i) => tent(`Stand ${i}`));
    expect(filterTents(many, 'stand', 8)).toHaveLength(8);
  });
});
