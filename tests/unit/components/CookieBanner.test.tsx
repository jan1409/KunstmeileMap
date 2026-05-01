import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import '../../../src/lib/i18n';
import i18n from 'i18next';

import { CookieBanner } from '../../../src/components/CookieBanner';

const KEY = 'kunstmeile_cookie_consent';

function renderInRouter() {
  return render(
    <MemoryRouter>
      <CookieBanner />
    </MemoryRouter>,
  );
}

describe('CookieBanner', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await i18n.changeLanguage('de');
  });

  it('renders the banner with the privacy link and OK button when no consent has been stored', () => {
    renderInRouter();
    expect(screen.getByRole('region', { name: /cookie consent/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /datenschutzerklärung/i })).toHaveAttribute(
      'href',
      '/datenschutz',
    );
    expect(screen.getByRole('button', { name: /^ok$/i })).toBeInTheDocument();
  });

  it('does not render when localStorage already contains the consent flag', () => {
    window.localStorage.setItem(KEY, '1');
    renderInRouter();
    expect(screen.queryByRole('region', { name: /cookie consent/i })).not.toBeInTheDocument();
  });

  it('persists consent to localStorage and dismisses on OK click', async () => {
    const user = userEvent.setup();
    renderInRouter();
    expect(window.localStorage.getItem(KEY)).toBeNull();

    await user.click(screen.getByRole('button', { name: /^ok$/i }));

    expect(window.localStorage.getItem(KEY)).toBe('1');
    expect(screen.queryByRole('region', { name: /cookie consent/i })).not.toBeInTheDocument();
  });

  it('renders English copy when the i18n language is en', async () => {
    await i18n.changeLanguage('en');
    renderInRouter();
    expect(screen.getByRole('link', { name: /privacy policy/i })).toBeInTheDocument();
    expect(screen.getByText(/strictly necessary cookies/i)).toBeInTheDocument();
  });
});
