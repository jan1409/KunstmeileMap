import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface State {
  isMember: boolean;
  fetchedFor: string | undefined;
}

export interface UseEventMembershipResult {
  isMember: boolean;
  loading: boolean;
}

/**
 * True when the user has at least one event_admins membership. Used by
 * RequireAuth to admit per-event collaborators (contributor/editor/owner)
 * into /admin even when their global profiles.role is not 'admin'. RLS
 * (event_admins_self_read) lets a user read their own membership rows.
 */
export function useEventMembership(userId: string | undefined): UseEventMembershipResult {
  const [state, setState] = useState<State>({ isMember: false, fetchedFor: undefined });

  // Loading is derived synchronously: when the userId we were asked about
  // doesn't match the userId we last fetched for, we're in flight. This
  // avoids the classic race where a setLoading(true) inside useEffect arrives
  // *after* the first render with the new userId, leaving consumers with a
  // stale loading=false on a render where state is actually unresolved.
  const loading = userId !== undefined && state.fetchedFor !== userId;

  useEffect(() => {
    if (!userId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs hook state when input becomes falsy. Long-term: migrate to TanStack Query.
      setState({ isMember: false, fetchedFor: undefined });
      return;
    }
    let cancelled = false;
    supabase
      .from('event_admins')
      .select('event_id')
      .eq('profile_id', userId)
      .limit(1)
      .then(({ data, error }) => {
        if (cancelled) return;
        setState({ isMember: !error && (data?.length ?? 0) > 0, fetchedFor: userId });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { isMember: state.isMember, loading };
}
