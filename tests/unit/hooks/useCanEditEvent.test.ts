import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { profileSingle, eventAdminMaybeSingle } = vi.hoisted(() => ({
  profileSingle: vi.fn(),
  eventAdminMaybeSingle: vi.fn(),
}));

vi.mock('../../../src/lib/supabase', () => {
  // profiles chain: from('profiles').select().eq().single()
  const profileEq = vi.fn().mockReturnValue({ single: profileSingle });
  const profileSelect = vi.fn().mockReturnValue({ eq: profileEq });

  // event_admins chain: from('event_admins').select().eq().eq().maybeSingle()
  const eventAdminEq2 = vi.fn().mockReturnValue({ maybeSingle: eventAdminMaybeSingle });
  const eventAdminEq1 = vi.fn().mockReturnValue({ eq: eventAdminEq2 });
  const eventAdminSelect = vi.fn().mockReturnValue({ eq: eventAdminEq1 });

  return {
    supabase: {
      from: vi.fn((table: string) => {
        if (table === 'profiles') return { select: profileSelect };
        if (table === 'event_admins') return { select: eventAdminSelect };
        throw new Error(`Unexpected table: ${table}`);
      }),
    },
  };
});

vi.mock('../../../src/components/AuthProvider', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../../../src/components/AuthProvider';
import { useCanEditEvent } from '../../../src/hooks/useCanEditEvent';

const useAuthMock = vi.mocked(useAuth);

describe('useCanEditEvent', () => {
  beforeEach(() => {
    profileSingle.mockReset();
    eventAdminMaybeSingle.mockReset();
    useAuthMock.mockReset();
  });

  it('returns canEdit=false and does not fetch when there is no session', async () => {
    useAuthMock.mockReturnValue({
      session: null,
      user: null,
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    const { result } = renderHook(() => useCanEditEvent('evt-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canEdit).toBe(false);
    expect(profileSingle).not.toHaveBeenCalled();
    expect(eventAdminMaybeSingle).not.toHaveBeenCalled();
  });

  it('reports loading=true while the profile fetch is still in flight', () => {
    useAuthMock.mockReturnValue({
      session: { user: { id: 'u-ed' } } as never,
      user: null,
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
    // Never-resolving profile fetch — simulates an in-flight request.
    profileSingle.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useCanEditEvent('evt-1'));

    expect(result.current.loading).toBe(true);
    expect(result.current.canEdit).toBe(false);
    expect(eventAdminMaybeSingle).not.toHaveBeenCalled();
  });

  it('returns canEdit=true for a global admin without consulting event_admins', async () => {
    useAuthMock.mockReturnValue({
      session: { user: { id: 'u-admin' } } as never,
      user: null, loading: false, signIn: vi.fn(), signOut: vi.fn(),
    });
    profileSingle.mockResolvedValue({
      data: { id: 'u-admin', role: 'admin' as const, full_name: 'A', created_at: '' },
      error: null,
    });

    const { result } = renderHook(() => useCanEditEvent('evt-1'));
    await waitFor(() => expect(result.current.canEdit).toBe(true));
    expect(eventAdminMaybeSingle).not.toHaveBeenCalled();
  });

  it('returns canEdit=true for an editor with an event_admins grant', async () => {
    useAuthMock.mockReturnValue({
      session: { user: { id: 'u-ed' } } as never,
      user: null, loading: false, signIn: vi.fn(), signOut: vi.fn(),
    });
    profileSingle.mockResolvedValue({
      data: { id: 'u-ed', role: 'editor' as const, full_name: 'E', created_at: '' },
      error: null,
    });
    eventAdminMaybeSingle.mockResolvedValue({
      data: { role_in_event: 'editor' },
      error: null,
    });

    const { result } = renderHook(() => useCanEditEvent('evt-1'));
    await waitFor(() => expect(result.current.canEdit).toBe(true));
  });

  it('returns canEdit=false for an editor without an event_admins grant', async () => {
    useAuthMock.mockReturnValue({
      session: { user: { id: 'u-ed' } } as never,
      user: null, loading: false, signIn: vi.fn(), signOut: vi.fn(),
    });
    profileSingle.mockResolvedValue({
      data: { id: 'u-ed', role: 'editor' as const, full_name: 'E', created_at: '' },
      error: null,
    });
    eventAdminMaybeSingle.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useCanEditEvent('evt-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canEdit).toBe(false);
  });

  it('exposes an Error and canEdit=false when event_admins query fails', async () => {
    useAuthMock.mockReturnValue({
      session: { user: { id: 'u-ed' } } as never,
      user: null, loading: false, signIn: vi.fn(), signOut: vi.fn(),
    });
    profileSingle.mockResolvedValue({
      data: { id: 'u-ed', role: 'editor' as const, full_name: 'E', created_at: '' },
      error: null,
    });
    eventAdminMaybeSingle.mockResolvedValue({
      data: null, error: { message: 'rls denied' },
    });

    const { result } = renderHook(() => useCanEditEvent('evt-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canEdit).toBe(false);
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('rls denied');
  });
});
