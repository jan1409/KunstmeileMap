import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../../../src/lib/i18n';

const authState = vi.fn();
vi.mock('../../../../src/components/AuthProvider', () => ({
  useAuth: () => authState(),
}));

const updateUser = vi.fn();
vi.mock('../../../../src/lib/supabase', () => ({
  supabase: { auth: { updateUser: (...a: unknown[]) => updateUser(...a) } },
}));

const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));

import WelcomePage from '../../../../src/pages/admin/WelcomePage';

function renderWelcome(entry = '/admin/welcome') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <WelcomePage />
    </MemoryRouter>,
  );
}

describe('WelcomePage', () => {
  beforeEach(() => {
    authState.mockReset();
    updateUser.mockReset();
    navigate.mockReset();
  });

  it('shows the set-password form when a session is present', () => {
    authState.mockReturnValue({ session: { user: { id: 'p-1' } }, loading: false });
    renderWelcome();
    expect(
      screen.getByPlaceholderText(/Neues Passwort|New password/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Passwort festlegen|Set password/i }),
    ).toBeInTheDocument();
  });

  it('shows the invalid-session message and a login link when there is no session', () => {
    authState.mockReturnValue({ session: null, loading: false });
    renderWelcome();
    expect(
      screen.getByText(/ungültig oder abgelaufen|invalid or has expired/i),
    ).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Zur Anmeldung|Go to login/i });
    expect(link).toHaveAttribute('href', '/admin/login');
  });

  it('shows a mismatch error and does NOT call updateUser when passwords differ', async () => {
    authState.mockReturnValue({ session: { user: { id: 'p-1' } }, loading: false });
    renderWelcome();
    const [pw, confirm] = screen.getAllByPlaceholderText(
      /Neues Passwort|New password|Passwort wiederholen|Repeat password/i,
    );
    fireEvent.change(pw!, { target: { value: 'longenough1' } });
    fireEvent.change(confirm!, { target: { value: 'different123' } });
    fireEvent.click(
      screen.getByRole('button', { name: /Passwort festlegen|Set password/i }),
    );
    await waitFor(() =>
      expect(
        screen.getByText(/stimmen nicht überein|do not match/i),
      ).toBeInTheDocument(),
    );
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('calls updateUser({ password }) and navigates to /admin on success', async () => {
    authState.mockReturnValue({ session: { user: { id: 'p-1' } }, loading: false });
    updateUser.mockResolvedValue({ error: null });
    renderWelcome();
    const [pw, confirm] = screen.getAllByPlaceholderText(
      /Neues Passwort|New password|Passwort wiederholen|Repeat password/i,
    );
    fireEvent.change(pw!, { target: { value: 'longenough1' } });
    fireEvent.change(confirm!, { target: { value: 'longenough1' } });
    fireEvent.click(
      screen.getByRole('button', { name: /Passwort festlegen|Set password/i }),
    );
    await waitFor(() =>
      expect(updateUser).toHaveBeenCalledWith({ password: 'longenough1' }),
    );
    expect(navigate).toHaveBeenCalledWith('/admin', { replace: true });
  });

  it('shows loading (not invalid) while a PKCE ?code= is present but the session has not arrived', () => {
    authState.mockReturnValue({ session: null, loading: false });
    renderWelcome('/admin/welcome?code=abc123');
    // Mid-exchange: neither the invalid message nor the form should show.
    expect(
      screen.queryByText(/ungültig oder abgelaufen|invalid or has expired/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(/Neues Passwort|New password/i),
    ).not.toBeInTheDocument();
    // It's the loading placeholder (role="status").
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('falls through to invalid_session after the grace period elapses without a session', () => {
    vi.useFakeTimers();
    try {
      authState.mockReturnValue({ session: null, loading: false });
      renderWelcome('/admin/welcome?code=abc123');
      expect(
        screen.queryByText(/ungültig oder abgelaufen|invalid or has expired/i),
      ).not.toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(
        screen.getByText(/ungültig oder abgelaufen|invalid or has expired/i),
      ).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows invalid_session immediately when there is no auth artifact in the URL', () => {
    authState.mockReturnValue({ session: null, loading: false });
    renderWelcome('/admin/welcome');
    expect(
      screen.getByText(/ungültig oder abgelaufen|invalid or has expired/i),
    ).toBeInTheDocument();
  });
});
