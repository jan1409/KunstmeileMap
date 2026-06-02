import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { TentWithCategories } from '../lib/supabase';
import { flattenTentCategories } from '../lib/tentCategories';
import { SNAPSHOT_MODE, snapshotTents } from '../lib/snapshot';

interface UseTentsResult {
  tents: TentWithCategories[];
  loading: boolean;
  error: Error | null;
}

export function useTents(eventId: string | undefined): UseTentsResult {
  const [tents, setTents] = useState<TentWithCategories[]>(() =>
    SNAPSHOT_MODE ? snapshotTents() : [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Snapshot build seeds tents from embedded data; nothing to fetch.
    if (SNAPSHOT_MODE) return;
    if (!eventId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronizes hook state when input becomes falsy; not derived state. Long-term: migrate to TanStack Query.
      setTents([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    supabase
      .from('tents')
      .select('*, tent_categories(category:categories(*))')
      .eq('event_id', eventId)
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError(new Error(err.message));
        else setTents(flattenTentCategories((data ?? []) as never));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  return { tents, loading, error };
}
