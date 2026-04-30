import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const { single, eq, update, insert } = vi.hoisted(() => ({
  single: vi.fn(),
  eq: vi.fn(),
  update: vi.fn(),
  insert: vi.fn().mockResolvedValue({ data: null, error: null }),
}));

vi.mock('../../../../src/lib/supabase', () => {
  // For tent fetch: from('tents').select('*').eq('id', X).single()
  // For update:    from('tents').update(...).eq('id', X)
  // For insert:    from('tents').insert(...)
  const select = vi.fn().mockReturnValue({ eq });
  return {
    supabase: {
      from: vi.fn().mockReturnValue({ select, update, insert }),
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

const sampleTent = {
  id: 'tent-1',
  event_id: 'evt-1',
  slug: 'galerie-nord',
  name: 'Galerie Nord',
  description_de: 'Eine Galerie',
  description_en: null,
  address: null,
  category_id: null,
  position: { x: 7, y: 0, z: 3 },
  website_url: null,
  instagram_url: null,
  facebook_url: null,
  email_public: null,
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
    single.mockReset();
    eq.mockReset();
    update.mockReset();
    insert.mockReset().mockResolvedValue({ data: null, error: null });
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
    expect(insert).toHaveBeenCalledTimes(1);
    const payload = insert.mock.calls[0]![0];
    expect(payload.event_id).toBe('evt-1');
    expect(payload.slug).toBe('galerie-nord');
    expect(payload.name).toBe('Galerie Nord');
    expect(payload.position).toEqual({ x: 4.2, y: 0, z: -1.1 });
    expect(payload.category_id).toBeNull();
    expect(payload.website_url).toBeNull();
  });

  it('loads an existing tent, pre-populates its position, and updates on submit', async () => {
    single.mockResolvedValue({ data: sampleTent, error: null });
    eq.mockReturnValue({ single });
    // For the update path we need from('tents').update(...).eq('id', 'tent-1')
    const updateEq = vi.fn().mockResolvedValue({ data: null, error: null });
    update.mockReturnValue({ eq: updateEq });

    const user = userEvent.setup();
    renderAt('/admin/events/kunstmeile-2026/tents/tent-1');

    expect(await screen.findByDisplayValue('galerie-nord')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Galerie Nord')).toBeInTheDocument();
    expect(screen.getByText('(7.00, 0.00, 3.00)')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /edit: galerie nord/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText('tent-list-page')).toBeInTheDocument();
    expect(update).toHaveBeenCalledTimes(1);
    expect(updateEq).toHaveBeenCalledWith('id', 'tent-1');
    const payload = update.mock.calls[0]![0];
    expect(payload.slug).toBe('galerie-nord');
    expect(payload.position).toEqual({ x: 7, y: 0, z: 3 });
  });
});
