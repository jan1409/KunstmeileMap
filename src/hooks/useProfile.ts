import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/supabase';

interface UseProfileResult {
  profile: Profile | null;
  loading: boolean;
  error: Error | null;
}

export function useProfile(userId: string | undefined): UseProfileResult {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronizes hook state when input becomes falsy; not derived state. Long-term: migrate to TanStack Query.
      setProfile(null);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError(new Error(err.message));
        else setProfile(data);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { profile, loading, error };
}
