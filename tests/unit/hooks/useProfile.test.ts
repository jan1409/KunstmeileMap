import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { single } = vi.hoisted(() => ({ single: vi.fn() }));

vi.mock('../../../src/lib/supabase', () => {
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  return {
    supabase: {
      from: vi.fn().mockReturnValue({ select }),
    },
  };
});

import { useProfile } from '../../../src/hooks/useProfile';

const adminProfile = {
  id: 'u-admin',
  role: 'admin' as const,
  full_name: 'Admin User',
  created_at: '2026-01-01T00:00:00Z',
};

describe('useProfile', () => {
  beforeEach(() => {
    single.mockReset();
  });

  it('fetches the profile row for the given userId', async () => {
    single.mockResolvedValue({ data: adminProfile, error: null });
    const { result } = renderHook(() => useProfile('u-admin'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.profile?.role).toBe('admin');
    expect(result.current.error).toBeNull();
  });

  it('does not fetch and exposes profile=null when userId is undefined', async () => {
    const { result } = renderHook(() => useProfile(undefined));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.profile).toBeNull();
    expect(result.current.error).toBeNull();
    expect(single).not.toHaveBeenCalled();
  });

  it('exposes an Error when the query fails', async () => {
    single.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const { result } = renderHook(() => useProfile('u-admin'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.profile).toBeNull();
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('boom');
  });

  it('refetches when userId changes', async () => {
    single
      .mockResolvedValueOnce({ data: adminProfile, error: null })
      .mockResolvedValueOnce({
        data: { ...adminProfile, id: 'u-editor', role: 'editor' as const },
        error: null,
      });
    const { result, rerender } = renderHook(({ id }) => useProfile(id), {
      initialProps: { id: 'u-admin' },
    });
    await waitFor(() => expect(result.current.profile?.role).toBe('admin'));

    rerender({ id: 'u-editor' });
    await waitFor(() => expect(result.current.profile?.role).toBe('editor'));
    expect(single).toHaveBeenCalledTimes(2);
  });
});
