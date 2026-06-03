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

/**
 * Target for the compressed lightbox preview when the event's
 * `lightbox_full_size` setting is off. Long edge in CSS px + JPEG quality —
 * matches the web-export snapshot, so multi-MB originals load as a few hundred
 * KB. The full original is never altered; this only changes the requested URL.
 */
const LIGHTBOX_PREVIEW_LONG_EDGE = 1600;
const LIGHTBOX_PREVIEW_QUALITY = 72;

export interface PhotoItem {
  /** Resized/recompressed variant for fast grid display. */
  thumbUrl: string;
  /**
   * URL shown by the full-screen lightbox. The original full-size file when the
   * event's `lightbox_full_size` is on; otherwise a compressed preview
   * (`LIGHTBOX_PREVIEW_*`). Controlled by the `lightboxFullSize` option.
   */
  fullUrl: string;
}

export function usePhotos(
  tentId: string | undefined,
  reloadKey: number = 0,
  options: { width?: number; lightboxFullSize?: boolean } = {},
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
    const fullSize = options.lightboxFullSize ?? true;
    supabase
      .from('tent_photos')
      .select('storage_path,display_order')
      .eq('tent_id', tentId)
      .order('display_order', { ascending: true })
      .then(({ data }) => {
        if (cancelled || !data) return;
        const result: PhotoItem[] = data.map((p) => ({
          thumbUrl: photoPublicUrl(p.storage_path, { width }),
          fullUrl: fullSize
            ? photoPublicUrl(p.storage_path)
            : photoPublicUrl(p.storage_path, {
                width: LIGHTBOX_PREVIEW_LONG_EDGE,
                height: LIGHTBOX_PREVIEW_LONG_EDGE,
                quality: LIGHTBOX_PREVIEW_QUALITY,
              }),
        }));
        setPhotos(result);
      });
    return () => {
      cancelled = true;
    };
  }, [tentId, reloadKey, options.width, options.lightboxFullSize]);

  return photos;
}
