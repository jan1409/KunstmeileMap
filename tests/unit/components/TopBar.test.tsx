import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import '../../../src/lib/i18n';
import i18n from 'i18next';

import { TopBar } from '../../../src/components/TopBar';
import { useIsMobile } from '../../../src/hooks/useIsMobile';
import type { Tent, Category } from '../../../src/lib/supabase';

vi.mock('../../../src/hooks/useIsMobile', () => ({
  useIsMobile: vi.fn(),
}));

const tents: Tent[] = [];
const categories: Category[] = [];

function renderTopBar() {
  return render(
    <TopBar
      tents={tents}
      categories={categories}
      selectedCategoryIds={new Set<string>()}
      onSelectTent={vi.fn()}
      onToggleCategory={vi.fn()}
      onClearCategories={vi.fn()}
    />,
  );
}

describe('TopBar', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('on desktop renders search, category filter, and language toggle without a hamburger', () => {
    vi.mocked(useIsMobile).mockReturnValue(false);
    renderTopBar();

    expect(screen.getByPlaceholderText(/stand suchen/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /alle anzeigen/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /switch to de/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /menü öffnen|menü schließen/i })).not.toBeInTheDocument();
  });

  it('on mobile starts collapsed: only the title and the hamburger toggle are visible', () => {
    vi.mocked(useIsMobile).mockReturnValue(true);
    renderTopBar();

    expect(screen.getByRole('heading', { name: /kunstmeile/i })).toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: /menü öffnen/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    expect(screen.queryByPlaceholderText(/stand suchen/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /alle anzeigen/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /switch to de/i })).not.toBeInTheDocument();
  });

  it('on mobile expands controls when the toggle is clicked and updates aria-expanded + aria-label', async () => {
    vi.mocked(useIsMobile).mockReturnValue(true);
    const user = userEvent.setup();
    renderTopBar();

    await user.click(screen.getByRole('button', { name: /menü öffnen/i }));

    expect(screen.getByPlaceholderText(/stand suchen/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /alle anzeigen/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /switch to de/i })).toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: /menü schließen/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('on mobile collapses again when the toggle is clicked a second time', async () => {
    vi.mocked(useIsMobile).mockReturnValue(true);
    const user = userEvent.setup();
    renderTopBar();

    await user.click(screen.getByRole('button', { name: /menü öffnen/i }));
    await user.click(screen.getByRole('button', { name: /menü schließen/i }));

    expect(screen.queryByPlaceholderText(/stand suchen/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /menü öffnen/i })).toHaveAttribute('aria-expanded', 'false');
  });
});
