import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '../../../../src/lib/i18n';

const eventState = vi.fn();
vi.mock('../../../../src/hooks/useEvent', () => ({
  useEvent: (...args: unknown[]) => eventState(...args),
}));

const usersState = vi.fn();
vi.mock('../../../../src/hooks/useEventUsers', () => ({
  useEventUsers: (...args: unknown[]) => usersState(...args),
}));

const authState = vi.fn();
vi.mock('../../../../src/components/AuthProvider', () => ({
  useAuth: () => authState(),
}));

vi.mock('../../../../src/components/ToastProvider', () => ({
  useToast: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}));

const { supabaseUpdate, supabaseDelete } = vi.hoisted(() => ({
  supabaseUpdate: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) }),
  supabaseDelete: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) }),
}));
vi.mock('../../../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({ update: supabaseUpdate, delete: supabaseDelete }),
    functions: { invoke: vi.fn().mockResolvedValue({ data: { ok: true }, error: null }) },
  },
}));

import UsersPage from '../../../../src/pages/admin/UsersPage';

function renderUsersPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/events/foo/users']}>
      <Routes>
        <Route path="/admin/events/:eventSlug/users" element={<UsersPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('UsersPage', () => {
  beforeEach(() => {
    eventState.mockReset();
    usersState.mockReset();
    authState.mockReset();
  });

  it('renders heading + invite form + user list when event and users are loaded', () => {
    eventState.mockReturnValue({ event: { id: 'ev1', slug: 'foo', title_de: 'Kunstmeile' }, loading: false, error: null });
    authState.mockReturnValue({ session: { user: { id: 'p-1' } } });
    usersState.mockReturnValue({
      users: [
        { profileId: 'p-1', email: 'me@example.com', fullName: 'Me', roleInEvent: 'owner', emailConfirmedAt: '2026-01-01', invitedAt: '2025-12-01' },
        { profileId: 'p-2', email: 'helga@example.com', fullName: 'Helga', roleInEvent: 'editor', emailConfirmedAt: '2026-02-01', invitedAt: '2026-01-15' },
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderUsersPage();
    expect(screen.getByText(/Benutzer — Kunstmeile|Users — Kunstmeile/i)).toBeInTheDocument();
    expect(screen.getByText('me@example.com')).toBeInTheDocument();
    expect(screen.getByText('helga@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Einladung senden|Send invitation/i })).toBeInTheDocument();
  });

  it('marks the current user as "Du selbst" / "You" and hides the remove button on their row', () => {
    eventState.mockReturnValue({ event: { id: 'ev1', slug: 'foo', title_de: 'Kunstmeile' }, loading: false, error: null });
    authState.mockReturnValue({ session: { user: { id: 'p-1' } } });
    usersState.mockReturnValue({
      users: [{ profileId: 'p-1', email: 'me@example.com', fullName: 'Me', roleInEvent: 'owner', emailConfirmedAt: '2026-01-01', invitedAt: '2025-12-01' }],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderUsersPage();
    expect(screen.getByText(/Du selbst|You/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Entfernen|Remove/i })).not.toBeInTheDocument();
  });

  it('renders the empty-state hint when only the current user exists', () => {
    eventState.mockReturnValue({ event: { id: 'ev1', slug: 'foo', title_de: 'Kunstmeile' }, loading: false, error: null });
    authState.mockReturnValue({ session: { user: { id: 'p-1' } } });
    usersState.mockReturnValue({
      users: [{ profileId: 'p-1', email: 'me@example.com', fullName: 'Me', roleInEvent: 'owner', emailConfirmedAt: '2026-01-01', invitedAt: '2025-12-01' }],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderUsersPage();
    expect(screen.getByText(/Lade Mitstreiter ein|Invite collaborators/i)).toBeInTheDocument();
  });
});
