import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function usePhotos(tentId: string | undefined): string[] {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    if (!tentId) {
      setUrls([]);
      return;
    }
    let cancelled = false;
    supabase
      .from('tent_photos')
      .select('storage_path,display_order')
      .eq('tent_id', tentId)
      .order('display_order', { ascending: true })
      .then(({ data }) => {
        if (cancelled || !data) return;
        const result: string[] = data.map((p) => {
          const { data: pub } = supabase.storage.from('tent-photos').getPublicUrl(p.storage_path);
          return pub.publicUrl;
        });
        setUrls(result);
      });
    return () => {
      cancelled = true;
    };
  }, [tentId]);

  return urls;
}
