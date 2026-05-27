import { useEventPermissions } from './useEventPermissions';

export interface UseCanEditEventResult {
  canEdit: boolean;
  loading: boolean;
  error: Error | null;
}

/**
 * Legacy wrapper preserving the pre-role-management API shape. New code should
 * use `useEventPermissions` directly. The `canEdit` field maps to the new
 * `canContribute` because the old "can edit" gate (photos + tent info) now
 * matches the contributor tier.
 */
export function useCanEditEvent(eventId: string | undefined): UseCanEditEventResult {
  const perms = useEventPermissions(eventId);
  return {
    canEdit: perms.canContribute,
    loading: perms.loading,
    error: null,
  };
}
