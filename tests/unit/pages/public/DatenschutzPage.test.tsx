import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import '../../../../src/lib/i18n';
import i18n from 'i18next';

import DatenschutzPage from '../../../../src/pages/public/DatenschutzPage';

describe('DatenschutzPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de');
  });

  it('renders the German privacy sections by default', () => {
    render(<DatenschutzPage />);
    expect(screen.getByRole('heading', { level: 1, name: /datenschutzerklärung/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /verantwortlicher/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /eingesetzte dienstleister/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /erhobene daten/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /rechtsgrundlage/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /speicherdauer/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /rechte der betroffenen/i })).toBeInTheDocument();
  });

  it('lists the actual processors used by the site', () => {
    render(<DatenschutzPage />);
    expect(screen.getByText(/vercel/i)).toBeInTheDocument();
    expect(screen.getByText(/supabase/i)).toBeInTheDocument();
    expect(screen.getByText(/cloudflare r2/i)).toBeInTheDocument();
  });

  it('renders the English version when the i18n language is en', async () => {
    await i18n.changeLanguage('en');
    render(<DatenschutzPage />);
    expect(screen.getByRole('heading', { level: 1, name: /privacy policy/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /controller/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /processors/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /your rights/i })).toBeInTheDocument();
  });

  it('exposes the controller email as a mailto link', () => {
    render(<DatenschutzPage />);
    expect(screen.getByRole('link', { name: /jan\.poepke@outlook\.de/i })).toHaveAttribute(
      'href',
      'mailto:jan.poepke@outlook.de',
    );
  });
});
