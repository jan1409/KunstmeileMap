import type { Tent } from './supabase';

/**
 * Filter tents for the public search box. Case-insensitive substring match on
 * the tent name OR the contact person (Ansprechperson) — visitors often know
 * the contact person better than the stall name. Returns up to `limit` matches;
 * an empty/whitespace query returns nothing.
 */
export function filterTents(tents: Tent[], query: string, limit = 8): Tent[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [];
  return tents
    .filter(
      (tnt) =>
        tnt.name.toLowerCase().includes(q) ||
        (tnt.contact_person?.toLowerCase().includes(q) ?? false),
    )
    .slice(0, limit);
}
