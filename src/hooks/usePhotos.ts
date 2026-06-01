import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { photoPublicUrl } from '../lib/photos';

/**
 * Width passed to Supabase Image Transformations for the public side panel.
 * The desktop panel is 400px wide; doubling for retina screens lands at ~800,
 * with a small headroom buffer so we don't re-upscale on slightly wider
 * tablets.
 */
const SIDE_PANEL_THUMB_WIDTH = 1024;

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
