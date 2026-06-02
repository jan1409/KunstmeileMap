import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { SNAPSHOT_MODE } from '../lib/snapshot';

export interface EventPermissions {
  loading: boolean;
  canAccess: boolean;
  canContribute: boolean;
  canEdit: boolean;
  canOwn: boolean;
}

const ALL_FALSE = {
  canAccess: false,
  canContribute: false,
  canEdit: false,
  canOwn: false,
};

interface State {
  fetchedFor: string | undefined;
  canAccess: boolean;
  canContribute: boolean;
  canEdit: boolean;
  canOwn: boolean;
}

const INITIAL: State = { fetchedFor: undefined, ...ALL_FALSE };

/**
 * Resolves the four event-scoped permission booleans for the current caller.
 * Calls `rpc('get_event_permissions', { eid })`. Falls back to all-false when
 * eventId is undefined or the RPC errors (defensive — RLS is the real gate).
 */
export function useEventPermissions(eventId: string | undefined): EventPermissions {
  const [state, setState] = useState<State>(INITIAL);

  useEffect(() => {
    // Offline snapshot has no caller/session: everyone is a read-only visitor.
    if (SNAPSHOT_MODE) return;
    if (!eventId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs hook state when input becomes falsy. Long-term: migrate to TanStack Query.
      setState(INITIAL);
      return;
    }
    let cancelled = false;
    supabase
      .rpc('get_event_permissions', { eid: eventId })
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setState({ fetchedFor: eventId, ...ALL_FALSE });
          return;
        }
        const row = data as {
          can_access: boolean;
          can_contribute: boolean;
          can_edit: boolean;
          can_own: boolean;
        };
        setState({
          fetchedFor: eventId,
          canAccess: row.can_access,
          canContribute: row.can_contribute,
          canEdit: row.can_edit,
          canOwn: row.can_own,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  // Loading is derived synchronously: when the eventId we were asked about
  // doesn't match the eventId we last fetched for, we're in flight. This
  // avoids the classic race where a setLoading(true) inside useEffect arrives
  // *after* the first render with the new eventId, leaving consumers with a
  // stale loading=false on a render where state is actually unresolved.
  const loading =
    !SNAPSHOT_MODE && eventId !== undefined && state.fetchedFor !== eventId;

  return {
    loading,
    canAccess: state.canAccess,
    canContribute: state.canContribute,
    canEdit: state.canEdit,
    canOwn: state.canOwn,
  };
}
