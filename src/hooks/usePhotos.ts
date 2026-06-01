import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { photoPublicUrl } from '../lib/photos';

/**
 * Width passed to Supabase Image Transformations for the public side panel.
 * On desktop the panel is a 2-col grid (each photo ~170px wide); on mobile
 * each photo renders at h-40 (~160px tall, variable width). 640px covers 2x
 * retina for both cases with a comfortable buffer.
 */
const SIDE_PANEL_THUMB_WIDTH = 640;

export function usePhotos(
  tentId: string | undefined,
  reloadKey: number = 0,
  options: { width?: number } = {},
): string[] {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    if (!tentId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronizes hook state when input becomes falsy; not derived state. Long-term: migrate to TanStack Query.
      setUrls([]);
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
        const result: string[] = data.map((p) =>
          photoPublicUrl(p.storage_path, { width }),
        );
        setUrls(result);
      });
    return () => {
      cancelled = true;
    };
  }, [tentId, reloadKey, options.width]);

  return urls;
}
