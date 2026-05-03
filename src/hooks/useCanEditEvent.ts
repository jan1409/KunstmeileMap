import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';
import { useProfile } from './useProfile';

export interface UseCanEditEventResult {
  canEdit: boolean;
  loading: boolean;
  error: Error | null;
}

interface State {
  fetchedFor: string | null; // `${eventId}|${profileId}` once decided
  canEdit: boolean;
  error: Error | null;
}

const INITIAL: State = { fetchedFor: null, canEdit: false, error: null };

/**
 * UX gate for "this user can edit photos for this event."
 *
 * Mirrors the storage RLS predicate `is_admin() OR has_event_role(eventId)`:
 * - global admin → canEdit=true (no event_admins fetch)
 * - per-event editor or owner → canEdit=true after a single event_admins lookup
 * - everyone else → canEdit=false
 *
 * This is a UX gate, not a security boundary. The actual boundary is the
 * Storage RLS policy on the `tent-photos` bucket; if this hook is wrong,
 * uploads still get rejected at the database.
 */
export function useCanEditEvent(eventId: string | undefined): UseCanEditEventResult {
  const { session } = useAuth();
  const profileId = session?.user?.id;
  const { profile, loading: profileLoading } = useProfile(profileId);
  const [state, setState] = useState<State>(INITIAL);

  const isAdmin = profile?.role === 'admin';
  const key = eventId && profileId ? `${eventId}|${profileId}` : null;

  useEffect(() => {
    // Reset when inputs become falsy.
    if (!session || !eventId || !profileId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs hook state when inputs become falsy. Long-term: migrate to TanStack Query.
      setState(INITIAL);
      return;
    }
    // Admin path: no fetch needed.
    if (isAdmin) {
      setState({ fetchedFor: key, canEdit: true, error: null });
      return;
    }
    // Skip while profile is still loading; we don't yet know if the user is admin.
    if (profileLoading) return;

    let cancelled = false;
    supabase
      .from('event_admins')
      .select('role_in_event')
      .eq('event_id', eventId)
      .eq('profile_id', profileId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        setState({
          fetchedFor: key,
          canEdit: !error && data != null,
          error: error ? new Error(error.message) : null,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [session, eventId, profileId, isAdmin, profileLoading, key]);

  // Loading is derived synchronously: still loading if profile is loading OR
  // we haven't decided for the current (eventId, profileId) tuple yet.
  const loading =
    !!session && !!eventId && !!profileId && (profileLoading || state.fetchedFor !== key);

  return { canEdit: state.canEdit, loading, error: state.error };
}
