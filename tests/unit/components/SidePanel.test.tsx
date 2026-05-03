import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../../../src/lib/i18n';
import { SidePanel } from '../../../src/components/SidePanel';
import type { Category, TentWithCategories } from '../../../src/lib/supabase';

// AddPhotosControl imports supabase even on idle render — mock it minimally.
vi.mock('../../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    storage: { from: vi.fn() },
  },
}));

// AddPhotosControl uses ToastProvider — mock it minimally.
vi.mock('../../../src/components/ToastProvider', () => ({
  useToast: () => ({ showError: vi.fn(), showSuccess: vi.fn() }),
}));

function makeTent(overrides: Partial<TentWithCategories> = {}): TentWithCategories {
  return {
    id: 'tent-1',
    slug: 'tent-1',
    event_id: 'evt-1',
    name: 'Test Tent',
    description_de: 'Beschreibung',
    description_en: 'Description',
    address: null,
    website_url: null,
    instagram_url: null,
    facebook_url: null,
    position: { x: 0, y: 0, z: 0 } as unknown as TentWithCategories['position'],
    display_number: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    created_by: null,
    updated_by: null,
    email_public: null,
    categories: [],
    ...overrides,
  } as unknown as TentWithCategories;
}

const noCategories: Category[] = [];

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>{ui}</MemoryRouter>
    </I18nextProvider>,
  );
}

describe('SidePanel', () => {
  it('hides the AddPhotosControl and Manage photos link when canEdit=false', () => {
    renderWithProviders(
      <SidePanel
        tent={makeTent()}
        categories={noCategories}
        photoUrls={[]}
        onClose={() => {}}
        eventId="evt-1"
        canEdit={false}
        onPhotosChanged={() => {}}
      />,
    );
    expect(
      screen.queryByRole('button', { name: /add photo|foto hinzufügen/i }),
    ).toBeNull();
    expect(
      screen.queryByRole('link', { name: /manage photos|fotos verwalten/i }),
    ).toBeNull();
  });

  it('shows the AddPhotosControl and Manage photos link when canEdit=true', () => {
    renderWithProviders(
      <SidePanel
        tent={makeTent()}
        categories={noCategories}
        photoUrls={[]}
        onClose={() => {}}
        eventId="evt-1"
        canEdit={true}
        onPhotosChanged={() => {}}
      />,
    );
    expect(
      screen.getByRole('button', { name: /add photo|foto hinzufügen/i }),
    ).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /manage photos|fotos verwalten/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/admin/tents/tent-1/edit');
  });

  it('returns null when tent is null (regardless of canEdit)', () => {
    const { container } = renderWithProviders(
      <SidePanel
        tent={null}
        categories={noCategories}
        photoUrls={[]}
        onClose={() => {}}
        eventId="evt-1"
        canEdit={true}
        onPhotosChanged={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
