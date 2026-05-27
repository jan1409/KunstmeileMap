import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface EventPermissions {
  loading: boolean;
  canAccess: boolean;
  canContribute: boolean;
  canEdit: boolean;
  canOwn: boolean;
}

const ALL_FALSE: Omit<EventPermissions, 'loading'> = {
  canAccess: false,
  canContribute: false,
  canEdit: false,
  canOwn: false,
};

/**
 * Resolves the four event-scoped permission booleans for the current caller.
 * Calls `rpc('get_event_permissions', { eid })`. Falls back to all-false when
 * eventId is undefined or the RPC errors (defensive — RLS is the real gate).
 */
export function useEventPermissions(eventId: string | undefined): EventPermissions {
  const [state, setState] = useState<EventPermissions>({ ...ALL_FALSE, loading: true });

  useEffect(() => {
    if (!eventId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs state when input becomes falsy. Long-term: TanStack Query.
      setState({ ...ALL_FALSE, loading: false });
      return;
    }
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true }));
    supabase
      .rpc('get_event_permissions', { eid: eventId })
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setState({ ...ALL_FALSE, loading: false });
          return;
        }
        const row = data as {
          can_access: boolean;
          can_contribute: boolean;
          can_edit: boolean;
          can_own: boolean;
        };
        setState({
          loading: false,
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

  return state;
}
