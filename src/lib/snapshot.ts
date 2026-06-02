import type { Category, Event, TentWithCategories } from './supabase';

/**
 * Static-snapshot runtime support. When the app is built with `VITE_SNAPSHOT=1`
 * (the "viewer" build, see vite.viewer.config.ts), it runs with **no Supabase
 * backend**: all event data is embedded in the page as `window.__KM_SNAPSHOT__`
 * by the export step, and photos are served from a sibling `photos/` folder.
 *
 * The public data hooks (useEvent/useTents/useCategories/usePhotos/
 * useEventPermissions) short-circuit on `SNAPSHOT_MODE` and read from here
 * instead of hitting the network. In the normal app build this constant is
 * `false`, so bundlers drop the snapshot branches as dead code.
 */

/** One exported photo: a relative path plus its captions. */
export interface SnapshotPhoto {
  /** Path relative to the bundle root, e.g. `photos/1_cafe-bergs/01.jpg`. */
  file: string;
  caption_de: string | null;
  caption_en: string | null;
}

/** Everything the offline viewer needs to render a single event. */
export interface SnapshotData {
  event: Event;
  tents: TentWithCategories[];
  categories: Category[];
  photosByTentId: Record<string, SnapshotPhoto[]>;
}

/** True only in the viewer build. Dead-code-eliminated from the normal build. */
export const SNAPSHOT_MODE = import.meta.env.VITE_SNAPSHOT === '1';

declare global {
  interface Window {
    /** Injected by the export step into the viewer's `index.html`. */
    __KM_SNAPSHOT__?: SnapshotData;
  }
}

/** Read the embedded snapshot, throwing a clear error if it's missing. */
export function getSnapshot(): SnapshotData {
  const data = typeof window !== 'undefined' ? window.__KM_SNAPSHOT__ : undefined;
  if (!data) {
    throw new Error(
      'Snapshot data missing: window.__KM_SNAPSHOT__ was not injected.',
    );
  }
  return data;
}

export function snapshotEvent(): Event {
  return getSnapshot().event;
}

export function snapshotTents(): TentWithCategories[] {
  return getSnapshot().tents;
}

export function snapshotCategories(): Category[] {
  return getSnapshot().categories;
}

export function snapshotPhotos(tentId: string): SnapshotPhoto[] {
  return getSnapshot().photosByTentId[tentId] ?? [];
}
