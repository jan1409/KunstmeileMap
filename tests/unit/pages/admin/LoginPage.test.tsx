import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const signIn = vi.fn();
vi.mock('../../../../src/components/AuthProvider', () => ({
  useAuth: () => ({ signIn }),
}));

import LoginPage from '../../../../src/pages/admin/LoginPage';

function renderApp(initial = '/admin/login') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/admin" element={<div>admin-home</div>} />
        <Route path="/admin/events" element={<div>events-page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    signIn.mockReset();
  });

  it('renders email + password fields and a submit button', () => {
    renderApp();
    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('navigates to /admin on successful sign-in', async () => {
    signIn.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    renderApp();

    await user.type(screen.getByPlaceholderText(/email/i), 'a@b.de');
    await user.type(screen.getByPlaceholderText(/password/i), 'pw');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(signIn).toHaveBeenCalledWith('a@b.de', 'pw');
    expect(await screen.findByText('admin-home')).toBeInTheDocument();
  });

  it('shows the error message when sign-in fails', async () => {
    signIn.mockResolvedValue({ error: new Error('Invalid login') });
    const user = userEvent.setup();
    renderApp();

    await user.type(screen.getByPlaceholderText(/email/i), 'a@b.de');
    await user.type(screen.getByPlaceholderText(/password/i), 'bad');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Invalid login')).toBeInTheDocument();
  });

  it('preserves the deep-link search and hash on successful sign-in', async () => {
    signIn.mockResolvedValue({ error: null });
    const user = userEvent.setup();

    function LocationDisplay() {
      const loc = useLocation();
      return <div data-testid="loc">{loc.pathname + loc.search + loc.hash}</div>;
    }

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/admin/login',
            state: { from: { pathname: '/admin/events', search: '?filter=open', hash: '#row5' } },
          },
        ]}
      >
        <Routes>
          <Route path="/admin/login" element={<LoginPage />} />
          <Route path="/admin/events" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByPlaceholderText(/email/i), 'a@b.de');
    await user.type(screen.getByPlaceholderText(/password/i), 'pw');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByTestId('loc')).toHaveTextContent('/admin/events?filter=open#row5');
  });
});
