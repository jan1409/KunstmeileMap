import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import '../../../src/lib/i18n';
import i18n from 'i18next';

const useAuthMock = vi.fn();
const signOutMock = vi.fn();
vi.mock('../../../src/components/AuthProvider', () => ({
  useAuth: () => ({ ...useAuthMock(), signOut: signOutMock }),
}));

const useProfileMock = vi.fn();
vi.mock('../../../src/hooks/useProfile', () => ({
  useProfile: (userId: string | undefined) => useProfileMock(userId),
}));

import { RequireAuth } from '../../../src/components/RequireAuth';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/login" element={<div>login-screen</div>} />
        <Route path="/admin/no-access" element={<div>no-access-screen</div>} />
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <div>admin-content</div>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

const adminProfile = { id: 'u1', role: 'admin' as const, full_name: null, created_at: '' };
const editorProfile = { id: 'u2', role: 'editor' as const, full_name: null, created_at: '' };

describe('RequireAuth', () => {
  it('shows a loading placeholder while auth is loading', () => {
    useAuthMock.mockReturnValue({ session: null, loading: true });
    useProfileMock.mockReturnValue({ profile: null, loading: false, error: null });
    renderAt('/admin');
    expect(screen.queryByText('admin-content')).toBeNull();
    expect(screen.queryByText('login-screen')).toBeNull();
    expect(screen.queryByText('no-access-screen')).toBeNull();
  });

  it('redirects to /admin/login when there is no session', () => {
    useAuthMock.mockReturnValue({ session: null, loading: false });
    useProfileMock.mockReturnValue({ profile: null, loading: false, error: null });
    renderAt('/admin');
    expect(screen.getByText('login-screen')).toBeInTheDocument();
  });

  it('shows a loading placeholder while the profile is being fetched', () => {
    useAuthMock.mockReturnValue({ session: { user: { id: 'u1' } }, loading: false });
    useProfileMock.mockReturnValue({ profile: null, loading: true, error: null });
    renderAt('/admin');
    expect(screen.queryByText('admin-content')).toBeNull();
    expect(screen.queryByText('no-access-screen')).toBeNull();
    expect(screen.queryByText('login-screen')).toBeNull();
  });

  it('redirects an editor (non-admin) to /admin/no-access', () => {
    useAuthMock.mockReturnValue({ session: { user: { id: 'u2' } }, loading: false });
    useProfileMock.mockReturnValue({ profile: editorProfile, loading: false, error: null });
    renderAt('/admin');
    expect(screen.getByText('no-access-screen')).toBeInTheDocument();
  });

  it('renders children when the user has the admin role', () => {
    useAuthMock.mockReturnValue({ session: { user: { id: 'u1' } }, loading: false });
    useProfileMock.mockReturnValue({ profile: adminProfile, loading: false, error: null });
    renderAt('/admin');
    expect(screen.getByText('admin-content')).toBeInTheDocument();
  });

  it('redirects to /admin/no-access when the profile fetch returned null (defensive)', () => {
    useAuthMock.mockReturnValue({ session: { user: { id: 'u-missing' } }, loading: false });
    useProfileMock.mockReturnValue({ profile: null, loading: false, error: null });
    renderAt('/admin');
    expect(screen.getByText('no-access-screen')).toBeInTheDocument();
  });

  it('shows an inline error block (not a redirect) when the profile fetch errored', async () => {
    await i18n.changeLanguage('en');
    useAuthMock.mockReturnValue({ session: { user: { id: 'u1' } }, loading: false });
    useProfileMock.mockReturnValue({
      profile: null,
      loading: false,
      error: new Error('rls denied profiles'),
    });
    renderAt('/admin');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/profile fetch failed/i);
    expect(alert).toHaveTextContent('rls denied profiles');
    // Not redirected to no-access.
    expect(screen.queryByText('no-access-screen')).toBeNull();
    // Sign-out button is the recovery affordance.
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });

  it('signs out and navigates to /admin/login when the sign-out button on the error block is clicked', async () => {
    await i18n.changeLanguage('en');
    signOutMock.mockReset();
    signOutMock.mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({ session: { user: { id: 'u1' } }, loading: false });
    useProfileMock.mockReturnValue({
      profile: null,
      loading: false,
      error: new Error('rls denied'),
    });
    const user = userEvent.setup();
    renderAt('/admin');

    await user.click(screen.getByRole('button', { name: /sign out/i }));

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('login-screen')).toBeInTheDocument();
  });
});
