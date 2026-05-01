import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Hoisted mock primitives — one set per table so chains are independent.
// ---------------------------------------------------------------------------
const {
  parseFn,
  // tents table — insert path: .insert(...).select('id').single()
  tentsInsert,
  tentsInsertSelect,
  tentsInsertSelectSingle,
  // tent_categories table — insert path: .insert([...])
  tcInsert,
} = vi.hoisted(() => {
  const parseFn = vi.fn();

  const tentsInsertSelectSingle = vi
    .fn()
    .mockResolvedValue({ data: { id: 'tent-new-id' }, error: null });
  const tentsInsertSelect = vi.fn().mockReturnValue({ single: tentsInsertSelectSingle });
  const tentsInsert = vi.fn().mockReturnValue({ select: tentsInsertSelect });

  const tcInsert = vi.fn().mockResolvedValue({ data: null, error: null });

  return {
    parseFn,
    tentsInsert,
    tentsInsertSelect,
    tentsInsertSelectSingle,
    tcInsert,
  };
});

vi.mock('papaparse', () => ({
  default: { parse: parseFn },
}));

vi.mock('../../../../src/lib/supabase', () => {
  // tents table mock: .insert(...).select('id').single()
  const tentsTableMock = {
    insert: tentsInsert,
  };

  // tent_categories table mock: .insert([...])
  const tentCategoriesTableMock = {
    insert: tcInsert,
  };

  return {
    supabase: {
      from: vi.fn((table: string) => {
        if (table === 'tents') return tentsTableMock;
        if (table === 'tent_categories') return tentCategoriesTableMock;
        throw new Error(`Unmocked table: ${table}`);
      }),
    },
  };
});

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
    display_number: '3',
    category_slugs: 'galerie',
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
    display_number: '',
    category_slugs: 'unknown-category',
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
    tentsInsertSelectSingle.mockReset().mockResolvedValue({ data: { id: 'tent-new-id' }, error: null });
    tentsInsertSelect.mockReset().mockReturnValue({ single: tentsInsertSelectSingle });
    tentsInsert.mockReset().mockReturnValue({ select: tentsInsertSelect });
    tcInsert.mockReset().mockResolvedValue({ data: null, error: null });
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
    expect(screen.getByText(/category_slugs/i)).toBeInTheDocument();
    expect(screen.getByText(/display_number/i)).toBeInTheDocument();
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

  it('inserts one tent per row with display_number, numeric position, null for empty fields, and no category_id column', async () => {
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

    await waitFor(() => expect(tentsInsert).toHaveBeenCalledTimes(2));

    const firstPayload = tentsInsert.mock.calls[0]![0];
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
      display_number: 3,
      position: { x: 1.5, y: 0, z: -2.3 },
    });
    // category_id must NOT be in the tents row
    expect(firstPayload).not.toHaveProperty('category_id');

    const secondPayload = tentsInsert.mock.calls[1]![0];
    expect(secondPayload.display_number).toBeNull();
    expect(secondPayload.position).toEqual({ x: 3, y: 0, z: 4 });
    expect(secondPayload).not.toHaveProperty('category_id');

    // tents insert uses .select('id').single() chain
    expect(tentsInsertSelect).toHaveBeenCalledWith('id');
    expect(tentsInsertSelectSingle).toHaveBeenCalled();
  });

  it('row with comma-separated category_slugs inserts one tent_categories row per matched slug', async () => {
    const multiCatRow = [
      {
        slug: 'multi-cat-tent',
        name: 'Multi Cat Tent',
        display_number: '',
        category_slugs: 'galerie,atelier',
        description_de: '',
        description_en: '',
        address: '',
        website_url: '',
        instagram_url: '',
        facebook_url: '',
        x: '1',
        y: '0',
        z: '2',
      },
    ];

    parseFn.mockImplementation(
      (_file: File, config: { complete: (res: { data: typeof multiCatRow }) => void }) => {
        config.complete({ data: multiCatRow });
      },
    );

    const user = userEvent.setup();
    renderApp();

    const file = new File(['csv'], 'tents.csv', { type: 'text/csv' });
    await user.upload(screen.getByLabelText(/csv file/i), file);
    await screen.findByText(/1 rows parsed/i);

    await user.click(screen.getByRole('button', { name: /import all/i }));

    await waitFor(() => expect(tcInsert).toHaveBeenCalledTimes(1));

    const insertedRows = tcInsert.mock.calls[0]![0] as Array<{ tent_id: string; category_id: string }>;
    expect(insertedRows).toHaveLength(2);
    expect(insertedRows).toEqual(
      expect.arrayContaining([
        { tent_id: 'tent-new-id', category_id: 'cat-galerie' },
        { tent_id: 'tent-new-id', category_id: 'cat-atelier' },
      ]),
    );
  });

  it('row with unknown category slugs logs them in the success line and still inserts the tent', async () => {
    const unknownCatRow = [
      {
        slug: 'mystery-tent',
        name: 'Mystery Tent',
        display_number: '',
        category_slugs: 'galerie,totally-unknown',
        description_de: '',
        description_en: '',
        address: '',
        website_url: '',
        instagram_url: '',
        facebook_url: '',
        x: '0',
        y: '0',
        z: '0',
      },
    ];

    parseFn.mockImplementation(
      (_file: File, config: { complete: (res: { data: typeof unknownCatRow }) => void }) => {
        config.complete({ data: unknownCatRow });
      },
    );

    const user = userEvent.setup();
    renderApp();

    const file = new File(['csv'], 'tents.csv', { type: 'text/csv' });
    await user.upload(screen.getByLabelText(/csv file/i), file);
    await screen.findByText(/1 rows parsed/i);

    await user.click(screen.getByRole('button', { name: /import all/i }));

    // tent inserted, galerie matched, totally-unknown logged in success line
    expect(await screen.findByText(/✓ mystery-tent.*unknown categories skipped: totally-unknown/)).toBeInTheDocument();
    // tent_categories insert called once (only for galerie)
    await waitFor(() => expect(tcInsert).toHaveBeenCalledTimes(1));
    const insertedRows = tcInsert.mock.calls[0]![0] as Array<{ tent_id: string; category_id: string }>;
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]).toEqual({ tent_id: 'tent-new-id', category_id: 'cat-galerie' });
  });

  it('row with explicit display_number sends that number; blank display_number sends null', async () => {
    const displayNumberRows = [
      {
        slug: 'tent-with-num',
        name: 'Tent With Number',
        display_number: '42',
        category_slugs: '',
        description_de: '',
        description_en: '',
        address: '',
        website_url: '',
        instagram_url: '',
        facebook_url: '',
        x: '0',
        y: '0',
        z: '0',
      },
      {
        slug: 'tent-no-num',
        name: 'Tent No Number',
        display_number: '',
        category_slugs: '',
        description_de: '',
        description_en: '',
        address: '',
        website_url: '',
        instagram_url: '',
        facebook_url: '',
        x: '0',
        y: '0',
        z: '0',
      },
    ];

    parseFn.mockImplementation(
      (_file: File, config: { complete: (res: { data: typeof displayNumberRows }) => void }) => {
        config.complete({ data: displayNumberRows });
      },
    );

    const user = userEvent.setup();
    renderApp();

    const file = new File(['csv'], 'tents.csv', { type: 'text/csv' });
    await user.upload(screen.getByLabelText(/csv file/i), file);
    await screen.findByText(/2 rows parsed/i);

    await user.click(screen.getByRole('button', { name: /import all/i }));

    await waitFor(() => expect(tentsInsert).toHaveBeenCalledTimes(2));

    expect(tentsInsert.mock.calls[0]![0].display_number).toBe(42);
    expect(tentsInsert.mock.calls[1]![0].display_number).toBeNull();
  });

  it('logs ✓ for successful inserts and ❌ with the error message for failed tent inserts', async () => {
    parseFn.mockImplementation(
      (_file: File, config: { complete: (res: { data: typeof sampleRows }) => void }) => {
        config.complete({ data: sampleRows });
      },
    );

    // First row succeeds, second tent insert fails
    tentsInsertSelectSingle
      .mockResolvedValueOnce({ data: { id: 'tent-new-id' }, error: null })
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

  it('logs ⚠️ when tent is inserted but tent_categories insert fails', async () => {
    const multiCatRow = [
      {
        slug: 'broken-cat-tent',
        name: 'Broken Cat Tent',
        display_number: '',
        category_slugs: 'galerie',
        description_de: '',
        description_en: '',
        address: '',
        website_url: '',
        instagram_url: '',
        facebook_url: '',
        x: '0',
        y: '0',
        z: '0',
      },
    ];

    parseFn.mockImplementation(
      (_file: File, config: { complete: (res: { data: typeof multiCatRow }) => void }) => {
        config.complete({ data: multiCatRow });
      },
    );

    tcInsert.mockResolvedValue({ data: null, error: { message: 'fk violation' } });

    const user = userEvent.setup();
    renderApp();

    const file = new File(['csv'], 'tents.csv', { type: 'text/csv' });
    await user.upload(screen.getByLabelText(/csv file/i), file);
    await screen.findByText(/1 rows parsed/i);

    await user.click(screen.getByRole('button', { name: /import all/i }));

    expect(
      await screen.findByText(/⚠️ broken-cat-tent: tent inserted but category link failed: fk violation/i),
    ).toBeInTheDocument();
  });

  it('skips tent_categories insert when category_slugs is empty', async () => {
    const noCatRow = [
      {
        slug: 'no-cat-tent',
        name: 'No Category Tent',
        display_number: '',
        category_slugs: '',
        description_de: '',
        description_en: '',
        address: '',
        website_url: '',
        instagram_url: '',
        facebook_url: '',
        x: '0',
        y: '0',
        z: '0',
      },
    ];

    parseFn.mockImplementation(
      (_file: File, config: { complete: (res: { data: typeof noCatRow }) => void }) => {
        config.complete({ data: noCatRow });
      },
    );

    const user = userEvent.setup();
    renderApp();

    const file = new File(['csv'], 'tents.csv', { type: 'text/csv' });
    await user.upload(screen.getByLabelText(/csv file/i), file);
    await screen.findByText(/1 rows parsed/i);

    await user.click(screen.getByRole('button', { name: /import all/i }));

    expect(await screen.findByText(/✓ no-cat-tent/)).toBeInTheDocument();
    expect(tcInsert).not.toHaveBeenCalled();
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
