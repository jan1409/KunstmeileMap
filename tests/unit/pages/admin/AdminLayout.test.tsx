import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const signOut = vi.fn();
const useAuthValue = { user: { email: 'admin@example.com' }, signOut };
vi.mock('../../../../src/components/AuthProvider', () => ({
  useAuth: () => useAuthValue,
}));

import AdminLayout from '../../../../src/pages/admin/AdminLayout';

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<div>dashboard-content</div>} />
        </Route>
        <Route path="/admin/login" element={<div>login-screen</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminLayout', () => {
  beforeEach(() => signOut.mockReset());

  it('renders the user email and the dashboard outlet', () => {
    renderApp();
    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
    expect(screen.getByText('dashboard-content')).toBeInTheDocument();
  });

  it('signs out and redirects to /admin/login when Sign out is clicked', async () => {
    signOut.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: /sign out/i }));

    expect(signOut).toHaveBeenCalled();
    expect(await screen.findByText('login-screen')).toBeInTheDocument();
  });

  it('still navigates to /admin/login when signOut rejects', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    signOut.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: /sign out/i }));

    expect(await screen.findByText('login-screen')).toBeInTheDocument();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('renders a skip link to the main content as the first focusable element', () => {
    renderApp();
    const link = screen.getByRole('link', { name: /skip to main content/i });
    expect(link).toHaveAttribute('href', '#main');
    expect(document.querySelector('main')).toHaveAttribute('id', 'main');
  });
});
