import type { Category, Tent, TentWithCategories } from './supabase';

interface RawTentRow extends Tent {
  tent_categories?: Array<{ category: Category | null }> | null;
}

export function flattenTentCategories(rows: RawTentRow[]): TentWithCategories[] {
  return rows.map((row) => {
    const { tent_categories, ...rest } = row;
    const categories = (tent_categories ?? [])
      .map((tc) => tc.category)
      .filter((c): c is Category => c !== null);
    return { ...rest, categories };
  });
}
