import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import '../../../../src/lib/i18n';

const useAuthMock = vi.fn();
vi.mock('../../../../src/components/AuthProvider', () => ({
  useAuth: () => useAuthMock(),
}));

const useProfileMock = vi.fn();
vi.mock('../../../../src/hooks/useProfile', () => ({
  useProfile: (userId: string | undefined) => useProfileMock(userId),
}));

import DashboardPage from '../../../../src/pages/admin/DashboardPage';

const adminProfile = { id: 'u1', role: 'admin' as const, full_name: null, created_at: '' };
const editorProfile = { id: 'u2', role: 'editor' as const, full_name: null, created_at: '' };

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin/events" element={<div>events-page</div>} />
        <Route path="/admin" element={<DashboardPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    useProfileMock.mockReset();
  });

  it('renders the dashboard for an admin (not redirected)', () => {
    useAuthMock.mockReturnValue({ session: { user: { id: 'u1' } }, loading: false });
    useProfileMock.mockReturnValue({ profile: adminProfile, loading: false, error: null });
    renderDashboard();
    expect(
      screen.getByRole('link', { name: /Events verwalten|Manage events/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText('events-page')).toBeNull();
  });

  it('redirects a non-admin (editor) to /admin/events', () => {
    useAuthMock.mockReturnValue({ session: { user: { id: 'u2' } }, loading: false });
    useProfileMock.mockReturnValue({ profile: editorProfile, loading: false, error: null });
    renderDashboard();
    expect(screen.getByText('events-page')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Events verwalten|Manage events/i }),
    ).toBeNull();
  });

  it('shows a placeholder while the profile is loading', () => {
    useAuthMock.mockReturnValue({ session: { user: { id: 'u2' } }, loading: false });
    useProfileMock.mockReturnValue({ profile: null, loading: true, error: null });
    renderDashboard();
    expect(screen.queryByText('events-page')).toBeNull();
    expect(
      screen.queryByRole('link', { name: /Events verwalten|Manage events/i }),
    ).toBeNull();
  });
});
