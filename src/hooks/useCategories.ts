import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Category } from '../lib/supabase';

interface UseCategoriesResult {
  categories: Category[];
  loading: boolean;
  error: Error | null;
}

export function useCategories(eventId: string | undefined): UseCategoriesResult {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!eventId) {
      setCategories([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    supabase
      .from('categories')
      .select('*')
      .eq('event_id', eventId)
      .order('display_order', { ascending: true })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError(new Error(err.message));
        else setCategories(data ?? []);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  return { categories, loading, error };
}
