import { useEffect, useRef, useState } from 'react';
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
  // Mirrors `event` in a ref so the effect can skip the loading-flash without
  // taking `event` as a dep (which would loop). Used to detect the
  // "/<event> → /<event>/tent/<x>" case where :eventSlug changes from
  // undefined to a string but resolves to the same already-loaded event.
  const eventRef = useRef<Event | null>(null);
  // eslint-disable-next-line react-hooks/refs -- mirrors `event` so the next effect can compare without making `event` a dep (would loop); the write is idempotent during render.
  eventRef.current = event;

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset error + sync loading (bail out if cached match, otherwise show spinner) before async fetch. Long-term: TanStack Query.
    setError(null);

    const cached = eventRef.current;
    const cachedMatchesSlug = cached != null && slug != null && cached.slug === slug;
    if (cachedMatchesSlug) {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);

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
