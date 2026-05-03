import type { MarkerData } from './three/MarkerLayer';
import type { TentWithCategories } from './supabase';

export function isXyz(v: unknown): v is { x: number; y: number; z: number } {
  return (
    typeof v === 'object' && v !== null &&
    typeof (v as { x?: unknown }).x === 'number' &&
    typeof (v as { y?: unknown }).y === 'number' &&
    typeof (v as { z?: unknown }).z === 'number'
  );
}

/**
 * Pick which tents render as map markers and shape them for `MarkerLayer`.
 *
 * - Tents with a non-{x,y,z} `position` are skipped (defensive — admin Place
 *   Mode in A3-T05 only emits valid).
 * - When `selectedCategoryIds` is non-empty, only tents matching at least one
 *   of those categories survive (OR-semantics) — UNLESS a tent is currently
 *   selected (`selectedTentId`), in which case it stays visible regardless so
 *   the open side panel keeps an anchor.
 */
export function selectVisibleMarkers(
  tents: TentWithCategories[],
  selectedCategoryIds: Set<string>,
  selectedTentId: string | null,
): MarkerData[] {
  const filterActive = selectedCategoryIds.size > 0;
  return tents
    .filter((t) => isXyz(t.position))
    .filter((t) => {
      if (!filterActive) return true;
      if (t.id === selectedTentId) return true;
      return t.categories.some((c) => selectedCategoryIds.has(c.id));
    })
    .map((t) => ({
      id: t.id,
      position: t.position as { x: number; y: number; z: number },
      label: t.display_number != null ? String(t.display_number) : null,
    }));
}
