import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';

// Hoisted mocks so we can manipulate session emission per test.
const mocks = vi.hoisted(() => {
  return {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    unsubscribe: vi.fn(),
  };
});

vi.mock('../../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
      signInWithPassword: mocks.signInWithPassword,
      signOut: mocks.signOut,
    },
  },
}));

import { AuthProvider, useAuth } from '../../../src/components/AuthProvider';

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

const fakeSession = {
  access_token: 'tok',
  refresh_token: 'r',
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: 'u1', email: 'admin@example.com' },
} as unknown;

describe('AuthProvider / useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mocks.unsubscribe } },
    });
    mocks.signInWithPassword.mockResolvedValue({ data: {}, error: null });
    mocks.signOut.mockResolvedValue({ error: null });
  });

  it('starts in loading state and resolves to no session', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();
  });

  it('exposes the user when getSession resolves with a session', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: fakeSession }, error: null });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).toBe(fakeSession);
    expect(result.current.user?.email).toBe('admin@example.com');
  });

  it('updates session when onAuthStateChange fires', async () => {
    let emit: (evt: string, s: unknown) => void = () => {};
    mocks.onAuthStateChange.mockImplementation((cb) => {
      emit = cb;
      return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).toBeNull();

    act(() => emit('SIGNED_IN', fakeSession));
    await waitFor(() => expect(result.current.session).toBe(fakeSession));
  });

  it('signIn calls supabase.auth.signInWithPassword and returns null error on success', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let returned: { error: Error | null } | undefined;
    await act(async () => {
      returned = await result.current.signIn('a@b.de', 'pw');
    });

    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.de', password: 'pw' });
    expect(returned!.error).toBeNull();
  });

  it('signIn wraps Supabase errors as Error', async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: {}, error: { message: 'Invalid login' } });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let returned: { error: Error | null } | undefined;
    await act(async () => {
      returned = await result.current.signIn('a@b.de', 'wrong');
    });

    expect(returned!.error).toBeInstanceOf(Error);
    expect(returned!.error!.message).toBe('Invalid login');
  });

  it('signOut calls supabase.auth.signOut', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signOut();
    });
    expect(mocks.signOut).toHaveBeenCalled();
  });

  it('useAuth throws when used outside AuthProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow(/AuthProvider/);
    spy.mockRestore();
  });
});
