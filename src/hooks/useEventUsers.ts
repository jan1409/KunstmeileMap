import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface EventUser {
  profileId: string;
  email: string;
  fullName: string | null;
  roleInEvent: 'owner' | 'editor' | 'contributor';
  emailConfirmedAt: string | null;
  invitedAt: string;
}

interface UseEventUsersResult {
  users: EventUser[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

interface State {
  fetchedFor: string | undefined;
  fetchedTick: number;
  users: EventUser[];
  error: Error | null;
}

const INITIAL: State = { fetchedFor: undefined, fetchedTick: 0, users: [], error: null };

export function useEventUsers(eventId: string | undefined): UseEventUsersResult {
  const [state, setState] = useState<State>(INITIAL);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!eventId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs hook state when input becomes falsy. Long-term: migrate to TanStack Query.
      setState(INITIAL);
      return;
    }
    let cancelled = false;

    supabase
      .rpc('get_event_users', { eid: eventId })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          setState({ fetchedFor: eventId, fetchedTick: tick, users: [], error: new Error(err.message) });
          return;
        }
        const rows = (data ?? []) as Array<{
          profile_id: string;
          email: string;
          full_name: string | null;
          role_in_event: 'owner' | 'editor' | 'contributor';
          email_confirmed_at: string | null;
          invited_at: string;
        }>;
        setState({
          fetchedFor: eventId,
          fetchedTick: tick,
          users: rows.map((r) => ({
            profileId: r.profile_id,
            email: r.email,
            fullName: r.full_name,
            roleInEvent: r.role_in_event,
            emailConfirmedAt: r.email_confirmed_at,
            invitedAt: r.invited_at,
          })),
          error: null,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, tick]);

  // Loading is derived synchronously: when the (eventId, tick) we were asked
  // about doesn't match the (fetchedFor, fetchedTick) we last resolved, we're
  // in flight. This avoids the classic race where a setLoading(true) inside
  // useEffect arrives *after* the first render with the new eventId, leaving
  // consumers with a stale loading=false on a render where state is actually
  // unresolved. Mirrors the pattern in useEventPermissions / useProfile
  // (post-c6c2d08), extended with a tick so refetch() also flips loading.
  const loading =
    eventId !== undefined && (state.fetchedFor !== eventId || state.fetchedTick !== tick);

  return { users: state.users, loading, error: state.error, refetch };
}
