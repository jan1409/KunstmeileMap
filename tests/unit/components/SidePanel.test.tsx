import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    lat: null,
    lng: null,
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
        photos={[]}
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
        photos={[]}
        onClose={() => {}}
        eventId="evt-1"
        eventSlug="evt-1-slug"
        canEdit={true}
        onPhotosChanged={() => {}}
      />,
    );
    expect(
      screen.getByRole('button', { name: /add photo|foto hinzufügen/i }),
    ).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /manage photos|fotos verwalten/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      'href',
      '/admin/events/evt-1-slug/tents/tent-1',
    );
  });

  it('renders the contact person name when tent.contact_person is set', () => {
    renderWithProviders(
      <SidePanel
        tent={makeTent({ contact_person: 'Anna Müller' })}
        categories={noCategories}
        photos={[]}
        onClose={() => {}}
        eventId="evt-1"
        canEdit={false}
        onPhotosChanged={() => {}}
      />,
    );
    // No label, just the bare name.
    expect(screen.getByText('Anna Müller')).toBeInTheDocument();
  });

  it('does NOT render the contact person line when contact_person is null or empty', () => {
    const { rerender } = renderWithProviders(
      <SidePanel
        tent={makeTent({ contact_person: null })}
        categories={noCategories}
        photos={[]}
        onClose={() => {}}
        eventId="evt-1"
        canEdit={false}
        onPhotosChanged={() => {}}
      />,
    );
    expect(screen.queryByText('Anna Müller')).toBeNull();

    rerender(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <SidePanel
            tent={makeTent({ contact_person: '' })}
            categories={noCategories}
            photos={[]}
            onClose={() => {}}
            eventId="evt-1"
            canEdit={false}
            onPhotosChanged={() => {}}
          />
        </MemoryRouter>
      </I18nextProvider>,
    );
    expect(screen.queryByText('Anna Müller')).toBeNull();
  });

  it('NEVER renders the internal phone number (it must stay off the public page)', () => {
    renderWithProviders(
      <SidePanel
        tent={makeTent({ phone: '+49 4141 123456' } as Partial<TentWithCategories>)}
        categories={noCategories}
        photos={[]}
        onClose={() => {}}
        eventId="evt-1"
        canEdit={false}
        onPhotosChanged={() => {}}
      />,
    );
    expect(screen.queryByText(/\+49 4141 123456/)).toBeNull();
  });

  it('opens the lightbox with the full-resolution image when a thumbnail is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <SidePanel
        tent={makeTent()}
        categories={noCategories}
        photos={[
          { thumbUrl: 'https://cdn/thumb1.jpg', fullUrl: 'https://cdn/full1.jpg' },
        ]}
        onClose={() => {}}
        eventId="evt-1"
        canEdit={false}
        onPhotosChanged={() => {}}
      />,
    );
    await user.click(
      screen.getByRole('button', { name: /view photo|foto ansehen/i }),
    );
    const backdrop = screen.getByTestId('lightbox-backdrop');
    expect(backdrop).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://cdn/full1.jpg');
    // Must be portaled to <body>, NOT nested inside the side-panel <aside> —
    // the panel's backdrop-blur would otherwise clip the fixed lightbox to it.
    expect(backdrop.closest('aside')).toBeNull();
    expect(backdrop.parentElement).toBe(document.body);
  });

  it('returns null when tent is null (regardless of canEdit)', () => {
    const { container } = renderWithProviders(
      <SidePanel
        tent={null}
        categories={noCategories}
        photos={[]}
        onClose={() => {}}
        eventId="evt-1"
        canEdit={true}
        onPhotosChanged={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
