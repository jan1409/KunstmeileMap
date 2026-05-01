import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Hoisted mock primitives — one set per table so chains are independent.
// ---------------------------------------------------------------------------
const {
  // tents table — load path
  tentsSingle,
  tentsEq,
  // tents table — update path
  tentsUpdate,
  tentsUpdateEq,
  // tents table — insert path (new tent)
  tentsInsert,
  tentsInsertSelect,
  tentsInsertSelectSingle,
  // tent_categories table — delete path
  tcDelete,
  tcDeleteEq,
  // tent_categories table — insert path
  tcInsert,
} = vi.hoisted(() => {
  const tentsInsertSelectSingle = vi.fn().mockResolvedValue({ data: { id: 'new-tent-uuid' }, error: null });
  const tentsInsertSelect = vi.fn().mockReturnValue({ single: tentsInsertSelectSingle });
  const tentsInsert = vi.fn().mockReturnValue({ select: tentsInsertSelect });

  const tentsUpdateEq = vi.fn().mockResolvedValue({ data: null, error: null });
  const tentsUpdate = vi.fn().mockReturnValue({ eq: tentsUpdateEq });

  const tentsSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const tentsEq = vi.fn().mockReturnValue({ single: tentsSingle });

  const tcDeleteEq = vi.fn().mockResolvedValue({ data: null, error: null });
  const tcDelete = vi.fn().mockReturnValue({ eq: tcDeleteEq });

  const tcInsert = vi.fn().mockResolvedValue({ data: null, error: null });

  return {
    tentsSingle,
    tentsEq,
    tentsUpdate,
    tentsUpdateEq,
    tentsInsert,
    tentsInsertSelect,
    tentsInsertSelectSingle,
    tcDelete,
    tcDeleteEq,
    tcInsert,
  };
});

vi.mock('../../../../src/lib/supabase', () => {
  // tents table mock:
  //   load:   .select('*, tent_categories(category_id)').eq('id', X).single()
  //   update: .update(...).eq('id', X)
  //   insert: .insert(...).select('id').single()
  const tentsSelect = vi.fn().mockReturnValue({ eq: tentsEq });
  const tentsTableMock = {
    select: tentsSelect,
    update: tentsUpdate,
    insert: tentsInsert,
  };

  // tent_categories table mock:
  //   delete: .delete().eq('tent_id', X)
  //   insert: .insert([...])
  const tentCategoriesTableMock = {
    delete: tcDelete,
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

// Capture the props passed to SplatViewer so we can drive its callbacks from
// the test without rendering WebGL.
const splatViewerProps: {
  current: Record<string, unknown> | null;
} = { current: null };

vi.mock('../../../../src/components/SplatViewer', () => ({
  SplatViewer: (props: Record<string, unknown>) => {
    splatViewerProps.current = props;
    return (
      <div data-testid="splat-viewer" data-place-mode={String(props.placeMode)}>
        <button
          type="button"
          onClick={() =>
            (props.onPlaceClick as (p: { x: number; y: number; z: number }) => void)?.({
              x: 4.2,
              y: 0,
              z: -1.1,
            })
          }
        >
          stub-place-click
        </button>
      </div>
    );
  },
}));

// PhotoUploadZone hits Supabase Storage + tent_photos directly; stub it here
// so the page-level tests don't have to mock that surface.
vi.mock('../../../../src/components/PhotoUploadZone', () => ({
  PhotoUploadZone: ({ eventId, tentId }: { eventId: string; tentId: string }) => (
    <div data-testid="photo-upload-zone" data-event-id={eventId} data-tent-id={tentId} />
  ),
}));

import TentEditPage from '../../../../src/pages/admin/TentEditPage';

const sampleEvent = {
  id: 'evt-1',
  slug: 'kunstmeile-2026',
  title_de: 'Kunstmeile 2026',
  title_en: null,
  year: 2026,
  status: 'published',
  is_featured: true,
  splat_url: 'https://example.com/scene.splat',
};

// sampleTent no longer has category_id — the Tent type dropped it.
// tent_categories are returned as a join in the load path.
const sampleTent = {
  id: 'tent-1',
  event_id: 'evt-1',
  slug: 'galerie-nord',
  name: 'Galerie Nord',
  description_de: 'Eine Galerie',
  description_en: null,
  address: null,
  display_number: null,
  position: { x: 7, y: 0, z: 3 },
  website_url: null,
  instagram_url: null,
  facebook_url: null,
  email_public: null,
  tent_categories: [] as Array<{ category_id: string }>,
};

function renderAt(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route
          path="/admin/events/:eventSlug/tents/new"
          element={<TentEditPage />}
        />
        <Route
          path="/admin/events/:eventSlug/tents/:tentId"
          element={<TentEditPage />}
        />
        <Route
          path="/admin/events/:eventSlug/tents"
          element={<div>tent-list-page</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TentEditPage', () => {
  beforeEach(() => {
    splatViewerProps.current = null;
    tentsSingle.mockReset().mockResolvedValue({ data: null, error: null });
    tentsEq.mockReset().mockReturnValue({ single: tentsSingle });
    tentsUpdate.mockReset().mockReturnValue({ eq: tentsUpdateEq });
    tentsUpdateEq.mockReset().mockResolvedValue({ data: null, error: null });
    tentsInsertSelectSingle.mockReset().mockResolvedValue({ data: { id: 'new-tent-uuid' }, error: null });
    tentsInsertSelect.mockReset().mockReturnValue({ single: tentsInsertSelectSingle });
    tentsInsert.mockReset().mockReturnValue({ select: tentsInsertSelect });
    tcDeleteEq.mockReset().mockResolvedValue({ data: null, error: null });
    tcDelete.mockReset().mockReturnValue({ eq: tcDeleteEq });
    tcInsert.mockReset().mockResolvedValue({ data: null, error: null });
    useEventMock.mockReset();
    useCategoriesMock.mockReset();

    useEventMock.mockReturnValue({ event: sampleEvent, loading: false, error: null });
    useCategoriesMock.mockReturnValue({ categories: [], loading: false, error: null });
  });

  it('renders the new-tent heading and a not-yet-placed form when path is /tents/new', () => {
    renderAt('/admin/events/kunstmeile-2026/tents/new');

    expect(screen.getByRole('heading', { name: /new tent/i })).toBeInTheDocument();
    expect(screen.getByText(/not placed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('passes placeMode=true to the SplatViewer after clicking "Place on scene"', async () => {
    const user = userEvent.setup();
    renderAt('/admin/events/kunstmeile-2026/tents/new');

    expect(splatViewerProps.current?.placeMode).toBeFalsy();

    await user.click(screen.getByRole('button', { name: /place on scene/i }));

    expect(splatViewerProps.current?.placeMode).toBe(true);
  });

  it('captures the world-space click from SplatViewer, exits place mode, and enables Save', async () => {
    const user = userEvent.setup();
    renderAt('/admin/events/kunstmeile-2026/tents/new');

    await user.click(screen.getByRole('button', { name: /place on scene/i }));
    expect(splatViewerProps.current?.placeMode).toBe(true);

    await user.click(screen.getByRole('button', { name: /stub-place-click/i }));

    expect(splatViewerProps.current?.placeMode).toBe(false);
    expect(screen.getByText('(4.20, 0.00, -1.10)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();
  });

  it('cancels place mode when ESC is pressed', async () => {
    const user = userEvent.setup();
    renderAt('/admin/events/kunstmeile-2026/tents/new');

    await user.click(screen.getByRole('button', { name: /place on scene/i }));
    expect(splatViewerProps.current?.placeMode).toBe(true);

    await user.keyboard('{Escape}');

    expect(splatViewerProps.current?.placeMode).toBe(false);
  });

  it('inserts the tent and navigates back to the tent list on a new-tent submit', async () => {
    const user = userEvent.setup();
    renderAt('/admin/events/kunstmeile-2026/tents/new');

    await user.click(screen.getByRole('button', { name: /place on scene/i }));
    await user.click(screen.getByRole('button', { name: /stub-place-click/i }));

    await user.type(screen.getByLabelText(/slug/i), 'galerie-nord');
    await user.type(screen.getByLabelText(/^name$/i), 'Galerie Nord');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText('tent-list-page')).toBeInTheDocument();
    expect(tentsInsert).toHaveBeenCalledTimes(1);
    const payload = tentsInsert.mock.calls[0]![0];
    expect(payload.event_id).toBe('evt-1');
    expect(payload.slug).toBe('galerie-nord');
    expect(payload.name).toBe('Galerie Nord');
    expect(payload.position).toEqual({ x: 4.2, y: 0, z: -1.1 });
    // category_ids is NOT written to the tents row
    expect(payload).not.toHaveProperty('category_ids');
    expect(payload).not.toHaveProperty('category_id');
    expect(payload.website_url).toBeNull();

    // tent_categories delete-then-insert runs even for a new tent
    // (delete is a no-op for a brand-new id, insert is skipped when empty)
    expect(tcDelete).toHaveBeenCalledTimes(1);
    // No categories selected → insert should NOT have been called
    expect(tcInsert).not.toHaveBeenCalled();
  });

  it('loads an existing tent, pre-populates its position, and updates on submit', async () => {
    tentsSingle.mockResolvedValue({ data: sampleTent, error: null });
    tentsEq.mockReturnValue({ single: tentsSingle });

    const user = userEvent.setup();
    renderAt('/admin/events/kunstmeile-2026/tents/tent-1');

    expect(await screen.findByDisplayValue('galerie-nord')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Galerie Nord')).toBeInTheDocument();
    expect(screen.getByText('(7.00, 0.00, 3.00)')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /edit: galerie nord/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText('tent-list-page')).toBeInTheDocument();
    expect(tentsUpdate).toHaveBeenCalledTimes(1);
    expect(tentsUpdateEq).toHaveBeenCalledWith('id', 'tent-1');
    const payload = tentsUpdate.mock.calls[0]![0];
    expect(payload.slug).toBe('galerie-nord');
    expect(payload.position).toEqual({ x: 7, y: 0, z: 3 });
    // category_ids must NOT be in the tents row
    expect(payload).not.toHaveProperty('category_ids');
    expect(payload).not.toHaveProperty('category_id');
  });

  it('updates the tent row and replaces tent_categories on save (edit path)', async () => {
    // Must be a real UUID (v4 format) so zod's z.string().uuid() passes.
    const CAT_UUID = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
    const sampleCategory = { category_id: CAT_UUID };
    const tentWithCategory = {
      ...sampleTent,
      tent_categories: [sampleCategory],
    };
    tentsSingle.mockResolvedValue({ data: tentWithCategory, error: null });
    tentsEq.mockReturnValue({ single: tentsSingle });

    // Provide a mock category so the checkbox renders
    useCategoriesMock.mockReturnValue({
      categories: [
        { id: CAT_UUID, name_de: 'Malerei', icon: '🎨', event_id: 'evt-1' },
      ],
      loading: false,
      error: null,
    });

    const user = userEvent.setup();
    renderAt('/admin/events/kunstmeile-2026/tents/tent-1');

    // Wait for the tent to load
    expect(await screen.findByDisplayValue('galerie-nord')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /save/i }));

    // Wait for the async save chain to complete and navigate away.
    await waitFor(() => expect(tentsUpdate).toHaveBeenCalledTimes(1), { timeout: 2000 });

    // 1. tents row must be updated
    expect(tentsUpdate).toHaveBeenCalledTimes(1);
    expect(tentsUpdateEq).toHaveBeenCalledWith('id', 'tent-1');

    // 2. tent_categories: delete first, then insert the selection
    expect(tcDelete).toHaveBeenCalledTimes(1);
    expect(tcDeleteEq).toHaveBeenCalledWith('tent_id', 'tent-1');
    expect(tcInsert).toHaveBeenCalledTimes(1);
    const insertedRows = tcInsert.mock.calls[0]![0] as Array<{ tent_id: string; category_id: string }>;
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]).toEqual({ tent_id: 'tent-1', category_id: CAT_UUID });
  });
});
