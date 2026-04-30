import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Event } from '../lib/supabase';

interface UseEventResult {
  event: Event | null;
  loading: boolean;
  error: Error | null;
}

export function useEvent(slug: string | undefined): UseEventResult {
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset loading/error before async fetch; React 19's preferred derived-state alternative would require a state-tracking refactor or a query library.
    setLoading(true);
    setError(null);

    const query = slug
      ? supabase.from('events').select('*').eq('slug', slug).single()
      : supabase.from('events').select('*').eq('is_featured', true).single();

    query.then(({ data, error: err }) => {
      if (cancelled) return;
      if (err) setError(new Error(err.message));
      else setEvent(data);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { event, loading, error };
}
