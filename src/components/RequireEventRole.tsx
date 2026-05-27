import type { ReactNode } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useEvent } from '../hooks/useEvent';
import { useEventPermissions, type EventPermissions } from '../hooks/useEventPermissions';

type MinRole = 'contributor' | 'editor' | 'owner';

interface Props {
  minRole: MinRole;
  children: ReactNode;
}

function meets(perms: EventPermissions, minRole: MinRole): boolean {
  if (minRole === 'contributor') return perms.canContribute;
  if (minRole === 'editor') return perms.canEdit;
  return perms.canOwn;
}

/**
 * Route-guard wrapper. Reads :eventSlug from the URL, resolves to an event id
 * via useEvent, then calls useEventPermissions and checks the requested
 * minRole. Renders a tiny placeholder while loading, redirects with
 * <Navigate> when access is denied, otherwise renders children.
 *
 * NOTE: UI gate only. The RLS policies enforce the same rule server-side —
 * any attempt to bypass this component still fails at the DB.
 */
export function RequireEventRole({ minRole, children }: Props) {
  const { eventSlug } = useParams<{ eventSlug?: string }>();
  const { event, loading: eventLoading } = useEvent(eventSlug);
  const perms = useEventPermissions(event?.id);

  if (eventLoading || perms.loading) {
    return <p className="p-6">…</p>;
  }

  if (!perms.canAccess) {
    return <Navigate to="/admin/no-access" replace />;
  }
  if (!meets(perms, minRole)) {
    return <Navigate to={`/admin/events/${eventSlug}/tents`} replace />;
  }
  return <>{children}</>;
}
