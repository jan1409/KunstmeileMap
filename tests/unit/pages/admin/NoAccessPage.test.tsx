import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import '../../../../src/lib/i18n';
import i18n from 'i18next';

const signOut = vi.fn();
vi.mock('../../../../src/components/AuthProvider', () => ({
  useAuth: () => ({ signOut }),
}));

import NoAccessPage from '../../../../src/pages/admin/NoAccessPage';

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/admin/no-access']}>
      <Routes>
        <Route path="/admin/no-access" element={<NoAccessPage />} />
        <Route path="/admin/login" element={<div>login-screen</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('NoAccessPage', () => {
  beforeEach(async () => {
    signOut.mockReset();
    signOut.mockResolvedValue(undefined);
    await i18n.changeLanguage('de');
  });

  it('renders the localized title, body and sign-out button (DE)', () => {
    renderApp();
    expect(screen.getByRole('heading', { name: /kein zugriff/i })).toBeInTheDocument();
    expect(screen.getByText(/admin-berechtigung/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /abmelden/i })).toBeInTheDocument();
  });

  it('renders English copy when i18n language is en', async () => {
    await i18n.changeLanguage('en');
    renderApp();
    expect(screen.getByRole('heading', { name: /no access/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });

  it('signs the user out and navigates to /admin/login on click', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: /abmelden/i }));

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('login-screen')).toBeInTheDocument();
  });

  it('still navigates to /admin/login when signOut rejects', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    signOut.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: /abmelden/i }));

    expect(await screen.findByText('login-screen')).toBeInTheDocument();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
