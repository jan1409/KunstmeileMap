import { useCallback, useEffect, useState } from 'react';
import type { TileStyle } from '../lib/map';

const STORAGE_KEY = 'kunstmeile.tileStyle';

/**
 * SSR-safe initial read: the `typeof window` guard lets this run in
 * non-browser test environments (and any future SSR / pre-render setup)
 * without exploding on `window.localStorage`. Invalid stored values fall
 * back to 'osm' rather than throwing.
 */
function readInitial(): TileStyle {
  if (typeof window === 'undefined') return 'osm';
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === 'satellite' ? 'satellite' : 'osm';
  } catch {
    return 'osm';
  }
}

/**
 * Persists the user's chosen tile provider ('osm' | 'satellite') in
 * localStorage so the choice is shared between the public map view and the
 * admin tent-map editor, and survives page reloads. The key
 * `kunstmeile.tileStyle` is read by all mount points.
 *
 * Cross-tab sync: when another tab toggles, the `storage` event mirrors the
 * change into this hook's state. Private-mode / quota errors are swallowed —
 * the in-memory state still works even if persistence fails.
 */
export function useTileStyle(): [TileStyle, (next: TileStyle) => void] {
  const [style, setStyle] = useState<TileStyle>(readInitial);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (
        e.key === STORAGE_KEY &&
        (e.newValue === 'osm' || e.newValue === 'satellite')
      ) {
        setStyle(e.newValue);
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const update = useCallback((next: TileStyle) => {
    setStyle(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore quota / private-mode errors — in-memory state still works.
    }
  }, []);

  return [style, update];
}
