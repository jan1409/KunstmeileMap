import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const { parseFn, insertFn } = vi.hoisted(() => ({
  parseFn: vi.fn(),
  insertFn: vi.fn(),
}));

vi.mock('papaparse', () => ({
  default: { parse: parseFn },
}));

vi.mock('../../../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({ insert: insertFn }),
  },
}));

const useEventMock = vi.fn();
vi.mock('../../../../src/hooks/useEvent', () => ({
  useEvent: (...args: unknown[]) => useEventMock(...args),
}));

const useCategoriesMock = vi.fn();
vi.mock('../../../../src/hooks/useCategories', () => ({
  useCategories: (...args: unknown[]) => useCategoriesMock(...args),
}));

import TentImportPage from '../../../../src/pages/admin/TentImportPage';

const sampleEvent = {
  id: 'evt-1',
  slug: 'kunstmeile-2026',
  title_de: 'Kunstmeile 2026',
};

const sampleCategories = [
  { id: 'cat-galerie', event_id: 'evt-1', slug: 'galerie' },
  { id: 'cat-atelier', event_id: 'evt-1', slug: 'atelier' },
];

const sampleRows = [
  {
    slug: 'galerie-nord',
    name: 'Galerie Nord',
    category_slug: 'galerie',
    description_de: 'Eine Galerie',
    description_en: '',
    address: 'Strasse 1',
    website_url: 'https://example.com',
    instagram_url: '',
    facebook_url: '',
    x: '1.5',
    y: '0',
    z: '-2.3',
  },
  {
    slug: 'atelier-sued',
    name: 'Atelier Süd',
    category_slug: 'unknown-category',
    description_de: '',
    description_en: '',
    address: '',
    website_url: '',
    instagram_url: '',
    facebook_url: '',
    x: '3',
    y: '0',
    z: '4',
  },
];

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/admin/events/kunstmeile-2026/tents/import']}>
      <Routes>
        <Route
          path="/admin/events/:eventSlug/tents/import"
          element={<TentImportPage />}
        />
        <Route
          path="/admin/events/:eventSlug/tents"
          element={<div>tent-list-page</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TentImportPage', () => {
  beforeEach(() => {
    parseFn.mockReset();
    insertFn.mockReset().mockResolvedValue({ data: null, error: null });
    useEventMock.mockReset();
    useCategoriesMock.mockReset();

    useEventMock.mockReturnValue({ event: sampleEvent, loading: false, error: null });
    useCategoriesMock.mockReturnValue({
      categories: sampleCategories,
      loading: false,
      error: null,
    });
  });

  it('renders the file input and the expected-column docs', () => {
    renderApp();

    expect(screen.getByLabelText(/csv file/i)).toBeInTheDocument();
    expect(screen.getByText(/category_slug/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /import all/i }),
    ).not.toBeInTheDocument();
  });

  it('parses the chosen file via papaparse and shows the row count', async () => {
    parseFn.mockImplementation(
      (_file: File, config: { complete: (res: { data: typeof sampleRows }) => void }) => {
        config.complete({ data: sampleRows });
      },
    );

    const user = userEvent.setup();
    renderApp();

    const file = new File(['csv'], 'tents.csv', { type: 'text/csv' });
    await user.upload(screen.getByLabelText(/csv file/i), file);

    expect(parseFn).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/2 rows parsed/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /import all/i }),
    ).toBeInTheDocument();
  });

  it('inserts one tent per row with mapped category_id, numeric position, and null for empty fields', async () => {
    parseFn.mockImplementation(
      (_file: File, config: { complete: (res: { data: typeof sampleRows }) => void }) => {
        config.complete({ data: sampleRows });
      },
    );

    const user = userEvent.setup();
    renderApp();

    const file = new File(['csv'], 'tents.csv', { type: 'text/csv' });
    await user.upload(screen.getByLabelText(/csv file/i), file);
    await screen.findByText(/2 rows parsed/i);

    await user.click(screen.getByRole('button', { name: /import all/i }));

    await waitFor(() => expect(insertFn).toHaveBeenCalledTimes(2));

    const firstPayload = insertFn.mock.calls[0]![0];
    expect(firstPayload).toMatchObject({
      event_id: 'evt-1',
      slug: 'galerie-nord',
      name: 'Galerie Nord',
      description_de: 'Eine Galerie',
      description_en: null,
      address: 'Strasse 1',
      website_url: 'https://example.com',
      instagram_url: null,
      facebook_url: null,
      category_id: 'cat-galerie',
      position: { x: 1.5, y: 0, z: -2.3 },
    });

    const secondPayload = insertFn.mock.calls[1]![0];
    // Unknown category slug → category_id = null (no broken FK).
    expect(secondPayload.category_id).toBeNull();
    expect(secondPayload.position).toEqual({ x: 3, y: 0, z: 4 });
  });

  it('logs ✓ for successful inserts and ❌ with the error message for failed ones', async () => {
    parseFn.mockImplementation(
      (_file: File, config: { complete: (res: { data: typeof sampleRows }) => void }) => {
        config.complete({ data: sampleRows });
      },
    );
    insertFn
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'duplicate key' } });

    const user = userEvent.setup();
    renderApp();

    const file = new File(['csv'], 'tents.csv', { type: 'text/csv' });
    await user.upload(screen.getByLabelText(/csv file/i), file);
    await screen.findByText(/2 rows parsed/i);

    await user.click(screen.getByRole('button', { name: /import all/i }));

    expect(await screen.findByText(/✓ galerie-nord/)).toBeInTheDocument();
    expect(
      await screen.findByText(/❌ atelier-sued: duplicate key/i),
    ).toBeInTheDocument();
  });

  it('links back to the tent list', () => {
    renderApp();

    const backLink = screen.getByRole('link', { name: /back/i });
    expect(backLink).toHaveAttribute(
      'href',
      '/admin/events/kunstmeile-2026/tents',
    );
  });
});
