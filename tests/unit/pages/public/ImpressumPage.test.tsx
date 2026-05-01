import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import ImpressumPage from '../../../../src/pages/public/ImpressumPage';

describe('ImpressumPage', () => {
  it('renders the legal sections required by German law (§ 5 TMG / § 18 MStV)', () => {
    render(<ImpressumPage />);

    expect(screen.getByRole('heading', { level: 1, name: /^impressum$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /diensteanbieter/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /kontakt/i })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /verantwortlich.*§ 18 Abs\. 2 MStV/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /haftung für inhalte/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /haftung für links/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /urheberrecht/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /online-streitbeilegung/i })).toBeInTheDocument();
  });

  it('exposes telephone and email as actionable links', () => {
    render(<ImpressumPage />);

    expect(screen.getByRole('link', { name: /\+49 1511 1359012/ })).toHaveAttribute(
      'href',
      'tel:+4915111359012',
    );
    expect(screen.getByRole('link', { name: /jan\.poepke@outlook\.de/i })).toHaveAttribute(
      'href',
      'mailto:jan.poepke@outlook.de',
    );
  });

  it('links to the EU online-dispute-resolution platform with safe rel attributes', () => {
    render(<ImpressumPage />);
    const link = screen.getByRole('link', { name: /ec\.europa\.eu\/consumers\/odr/i });
    expect(link).toHaveAttribute('href', 'https://ec.europa.eu/consumers/odr');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});
