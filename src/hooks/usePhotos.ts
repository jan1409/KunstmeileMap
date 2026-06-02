import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { photoPublicUrl } from '../lib/photos';
import { SNAPSHOT_MODE, snapshotPhotos } from '../lib/snapshot';

/**
 * Width passed to Supabase Image Transformations for the public side panel.
 * On desktop the panel is a 2-col grid (each photo ~170px wide); on mobile
 * each photo renders at h-40 (~160px tall, variable width). 640px covers 2x
 * retina for both cases with a comfortable buffer.
 */
const SIDE_PANEL_THUMB_WIDTH = 640;

export interface PhotoItem {
  /** Resized/recompressed variant for fast grid display. */
  thumbUrl: string;
  /** Original, uncompressed file — used by the full-screen lightbox. */
  fullUrl: string;
}

export function usePhotos(
  tentId: string | undefined,
  reloadKey: number = 0,
  options: { width?: number } = {},
): PhotoItem[] {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);

  useEffect(() => {
    if (!tentId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronizes hook state when input becomes falsy; not derived state. Long-term: migrate to TanStack Query.
      setPhotos([]);
      return;
    }
    if (SNAPSHOT_MODE) {
      // Offline build: one optimized file per photo serves both grid and lightbox.
      setPhotos(
        snapshotPhotos(tentId).map((p) => ({ thumbUrl: p.file, fullUrl: p.file })),
      );
      return;
    }
    let cancelled = false;
    const width = options.width ?? SIDE_PANEL_THUMB_WIDTH;
    supabase
      .from('tent_photos')
      .select('storage_path,display_order')
      .eq('tent_id', tentId)
      .order('display_order', { ascending: true })
      .then(({ data }) => {
        if (cancelled || !data) return;
        const result: PhotoItem[] = data.map((p) => ({
          thumbUrl: photoPublicUrl(p.storage_path, { width }),
          fullUrl: photoPublicUrl(p.storage_path),
        }));
        setPhotos(result);
      });
    return () => {
      cancelled = true;
    };
  }, [tentId, reloadKey, options.width]);

  return photos;
}
