import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const useAuthMock = vi.fn();
vi.mock('../../../src/components/AuthProvider', () => ({
  useAuth: () => useAuthMock(),
}));

import { RequireAuth } from '../../../src/components/RequireAuth';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/login" element={<div>login-screen</div>} />
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

describe('RequireAuth', () => {
  it('shows a loading placeholder while auth is loading', () => {
    useAuthMock.mockReturnValue({ session: null, loading: true });
    renderAt('/admin');
    expect(screen.queryByText('admin-content')).toBeNull();
    expect(screen.queryByText('login-screen')).toBeNull();
  });

  it('redirects to /admin/login when there is no session', () => {
    useAuthMock.mockReturnValue({ session: null, loading: false });
    renderAt('/admin');
    expect(screen.getByText('login-screen')).toBeInTheDocument();
  });

  it('renders children when session exists', () => {
    useAuthMock.mockReturnValue({ session: { user: { id: 'u1' } }, loading: false });
    renderAt('/admin');
    expect(screen.getByText('admin-content')).toBeInTheDocument();
  });
});
