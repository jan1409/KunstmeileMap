import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useEventPermissions } from '../../../src/hooks/useEventPermissions';

const rpcSingle = vi.fn();
const rpc = vi.fn().mockReturnValue({ single: rpcSingle });

vi.mock('../../../src/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

describe('useEventPermissions', () => {
  beforeEach(() => {
    rpc.mockClear();
    rpcSingle.mockReset();
  });

  it('returns loading=true initially', () => {
    rpcSingle.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useEventPermissions('event-1'));
    expect(result.current.loading).toBe(true);
    expect(result.current.canAccess).toBe(false);
    expect(result.current.canContribute).toBe(false);
    expect(result.current.canEdit).toBe(false);
    expect(result.current.canOwn).toBe(false);
  });

  it('returns all four booleans true for a global admin / owner', async () => {
    rpcSingle.mockResolvedValue({
      data: { can_access: true, can_contribute: true, can_edit: true, can_own: true },
      error: null,
    });
    const { result } = renderHook(() => useEventPermissions('event-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canAccess).toBe(true);
    expect(result.current.canContribute).toBe(true);
    expect(result.current.canEdit).toBe(true);
    expect(result.current.canOwn).toBe(true);
  });

  it('returns canOwn=false for an editor', async () => {
    rpcSingle.mockResolvedValue({
      data: { can_access: true, can_contribute: true, can_edit: true, can_own: false },
      error: null,
    });
    const { result } = renderHook(() => useEventPermissions('event-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canOwn).toBe(false);
    expect(result.current.canEdit).toBe(true);
  });

  it('returns canEdit=false and canOwn=false for a contributor', async () => {
    rpcSingle.mockResolvedValue({
      data: { can_access: true, can_contribute: true, can_edit: false, can_own: false },
      error: null,
    });
    const { result } = renderHook(() => useEventPermissions('event-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canAccess).toBe(true);
    expect(result.current.canContribute).toBe(true);
    expect(result.current.canEdit).toBe(false);
    expect(result.current.canOwn).toBe(false);
  });

  it('returns all booleans false for a non-member', async () => {
    rpcSingle.mockResolvedValue({
      data: { can_access: false, can_contribute: false, can_edit: false, can_own: false },
      error: null,
    });
    const { result } = renderHook(() => useEventPermissions('event-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canAccess).toBe(false);
  });

  it('returns all false and stops loading when eventId is undefined', async () => {
    const { result } = renderHook(() => useEventPermissions(undefined));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canAccess).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});
