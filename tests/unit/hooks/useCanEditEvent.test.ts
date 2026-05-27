import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('../../../src/hooks/useEventPermissions', () => ({
  useEventPermissions: vi.fn(),
}));

import { useCanEditEvent } from '../../../src/hooks/useCanEditEvent';
import { useEventPermissions } from '../../../src/hooks/useEventPermissions';

// useCanEditEvent is a legacy back-compat wrapper over useEventPermissions.
// It maps the new `canContribute` tier onto the old `canEdit` field because
// the previous gate (photos + tent info) now corresponds to "contributor".
describe('useCanEditEvent (wrapper over useEventPermissions)', () => {
  beforeEach(() => {
    vi.mocked(useEventPermissions).mockReset();
  });

  it('passes the eventId through to useEventPermissions', () => {
    vi.mocked(useEventPermissions).mockReturnValue({
      loading: false,
      canAccess: false,
      canContribute: false,
      canEdit: false,
      canOwn: false,
    });

    renderHook(() => useCanEditEvent('evt-1'));

    expect(useEventPermissions).toHaveBeenCalledWith('evt-1');
  });

  it('maps canContribute=true to canEdit=true', () => {
    vi.mocked(useEventPermissions).mockReturnValue({
      loading: false,
      canAccess: true,
      canContribute: true,
      canEdit: false,
      canOwn: false,
    });

    const { result } = renderHook(() => useCanEditEvent('evt-1'));

    expect(result.current.canEdit).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('maps canContribute=false to canEdit=false even when canAccess=true', () => {
    vi.mocked(useEventPermissions).mockReturnValue({
      loading: false,
      canAccess: true,
      canContribute: false,
      canEdit: false,
      canOwn: false,
    });

    const { result } = renderHook(() => useCanEditEvent('evt-1'));

    expect(result.current.canEdit).toBe(false);
  });

  it('forwards loading=true from useEventPermissions', () => {
    vi.mocked(useEventPermissions).mockReturnValue({
      loading: true,
      canAccess: false,
      canContribute: false,
      canEdit: false,
      canOwn: false,
    });

    const { result } = renderHook(() => useCanEditEvent('evt-1'));

    expect(result.current.loading).toBe(true);
    expect(result.current.canEdit).toBe(false);
  });

  it('returns canEdit=false when eventId is undefined', () => {
    vi.mocked(useEventPermissions).mockReturnValue({
      loading: false,
      canAccess: false,
      canContribute: false,
      canEdit: false,
      canOwn: false,
    });

    const { result } = renderHook(() => useCanEditEvent(undefined));

    expect(useEventPermissions).toHaveBeenCalledWith(undefined);
    expect(result.current.canEdit).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  it('always exposes error=null (errors are swallowed by the underlying hook)', () => {
    vi.mocked(useEventPermissions).mockReturnValue({
      loading: false,
      canAccess: false,
      canContribute: false,
      canEdit: false,
      canOwn: false,
    });

    const { result } = renderHook(() => useCanEditEvent('evt-1'));

    expect(result.current.error).toBeNull();
  });
});
