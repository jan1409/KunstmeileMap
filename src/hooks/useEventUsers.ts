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

export function useEventUsers(eventId: string | undefined): UseEventUsersResult {
  const [users, setUsers] = useState<EventUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!eventId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs state when input becomes falsy. Long-term: TanStack Query.
      setUsers([]);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    supabase
      .rpc('get_event_users', { eid: eventId })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          setError(new Error(err.message));
          setUsers([]);
        } else {
          const rows = (data ?? []) as Array<{
            profile_id: string;
            email: string;
            full_name: string | null;
            role_in_event: 'owner' | 'editor' | 'contributor';
            email_confirmed_at: string | null;
            invited_at: string;
          }>;
          setUsers(
            rows.map((r) => ({
              profileId: r.profile_id,
              email: r.email,
              fullName: r.full_name,
              roleInEvent: r.role_in_event,
              emailConfirmedAt: r.email_confirmed_at,
              invitedAt: r.invited_at,
            })),
          );
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, tick]);

  return { users, loading, error, refetch };
}
