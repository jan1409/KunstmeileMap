import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Tent } from '../lib/supabase';

interface UseTentsResult {
  tents: Tent[];
  loading: boolean;
  error: Error | null;
}

export function useTents(eventId: string | undefined): UseTentsResult {
  const [tents, setTents] = useState<Tent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
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
      .select('*')
      .eq('event_id', eventId)
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError(new Error(err.message));
        else setTents(data ?? []);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  return { tents, loading, error };
}
