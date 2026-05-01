import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/supabase';

interface UseProfileResult {
  profile: Profile | null;
  loading: boolean;
  error: Error | null;
}

interface State {
  fetchedFor: string | undefined;
  profile: Profile | null;
  error: Error | null;
}

const INITIAL: State = { fetchedFor: undefined, profile: null, error: null };

export function useProfile(userId: string | undefined): UseProfileResult {
  const [state, setState] = useState<State>(INITIAL);

  useEffect(() => {
    if (!userId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs hook state when input becomes falsy. Long-term: migrate to TanStack Query.
      setState(INITIAL);
      return;
    }
    let cancelled = false;
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
      .then(({ data, error: err }) => {
        if (cancelled) return;
        setState({
          fetchedFor: userId,
          profile: data ?? null,
          error: err ? new Error(err.message) : null,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Loading is derived synchronously: when the userId we were asked about
  // doesn't match the userId we last fetched for, we're in flight. This
  // avoids the classic race where a setLoading(true) inside useEffect arrives
  // *after* the first render with the new userId, leaving consumers with a
  // stale loading=false on a render where state is actually unresolved.
  const loading = userId !== undefined && state.fetchedFor !== userId;

  return { profile: state.profile, loading, error: state.error };
}
