import { useCallback, useMemo, useState } from 'react';

export interface Coords {
  lat: number;
  lng: number;
}

type DirtyMap = Record<string, Coords>;

const EPSILON = 1e-9;

function nearlyEqual(a: Coords, b: Coords): boolean {
  return Math.abs(a.lat - b.lat) < EPSILON && Math.abs(a.lng - b.lng) < EPSILON;
}

export interface UseDirtyPositionsApi {
  isDirty: (id: string) => boolean;
  dirtyIds: Set<string>;
  dirtyCount: number;
  getCoords: (id: string) => Coords | undefined;
  set: (id: string, coords: Coords) => void;
  revert: (id: string) => void;
  revertAll: () => void;
  /** Drop the given ids from edits. Use after a successful save. */
  commit: (ids: string[]) => void;
}

/**
 * Tracks per-tent staged coordinate edits against an immutable `originals`
 * snapshot. `set()` to coords that match the original (within 1e-9) drops the
 * entry — so revert-by-dragging-back works automatically.
 *
 * The hook does NOT auto-reset when `originals` changes. The caller owns the
 * lifecycle and must call `commit(ids)` after a successful save.
 */
export function useDirtyPositions(
  originals: Record<string, Coords>,
): UseDirtyPositionsApi {
  const [edits, setEdits] = useState<DirtyMap>({});

  const set = useCallback(
    (id: string, coords: Coords) => {
      setEdits((prev) => {
        const original = originals[id];
        if (original && nearlyEqual(coords, original)) {
          if (!(id in prev)) return prev;
          const { [id]: _drop, ...rest } = prev;
          return rest;
        }
        return { ...prev, [id]: coords };
      });
    },
    [originals],
  );

  const revert = useCallback((id: string) => {
    setEdits((prev) => {
      if (!(id in prev)) return prev;
      const { [id]: _drop, ...rest } = prev;
      return rest;
    });
  }, []);

  const revertAll = useCallback(() => setEdits({}), []);

  const commit = useCallback((ids: string[]) => {
    setEdits((prev) => {
      const next = { ...prev };
      for (const id of ids) delete next[id];
      return next;
    });
  }, []);

  const dirtyIds = useMemo(() => new Set(Object.keys(edits)), [edits]);

  return {
    isDirty: (id) => id in edits,
    dirtyIds,
    dirtyCount: dirtyIds.size,
    getCoords: (id) => edits[id] ?? originals[id],
    set,
    revert,
    revertAll,
    commit,
  };
}
