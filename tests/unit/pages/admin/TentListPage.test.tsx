import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const { eq, order } = vi.hoisted(() => ({
  eq: vi.fn(),
  order: vi.fn(),
}));

vi.mock('../../../../src/lib/supabase', () => {
  const select = vi.fn().mockReturnValue({ eq });
  return {
    supabase: {
      from: vi.fn().mockReturnValue({ select }),
    },
  };
});

const useEventMock = vi.fn();
vi.mock('../../../../src/hooks/useEvent', () => ({
  useEvent: (...args: unknown[]) => useEventMock(...args),
}));

import TentListPage from '../../../../src/pages/admin/TentListPage';

const sampleEvent = {
  id: 'evt-1',
  slug: 'kunstmeile-2026',
  title_de: 'Kunstmeile 2026',
  title_en: null,
  year: 2026,
  status: 'published',
  is_featured: true,
};

const sampleTents = [
  {
    id: 'tent-a',
    event_id: 'evt-1',
    slug: 'galerie-nord',
    name: 'Galerie Nord',
    position: { x: 1, y: 0, z: 2 },
  },
  {
    id: 'tent-b',
    event_id: 'evt-1',
    slug: 'atelier-sued',
    name: 'Atelier Süd',
    position: { x: -3, y: 0, z: 5 },
  },
];

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/admin/events/kunstmeile-2026/tents']}>
      <Routes>
        <Route
          path="/admin/events/:eventSlug/tents"
          element={<TentListPage />}
        />
        <Route
          path="/admin/events/:eventSlug/tents/new"
          element={<div>new-tent-page</div>}
        />
        <Route
          path="/admin/events/:eventSlug/tents/:tentId"
          element={<div>tent-edit-page</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TentListPage', () => {
  beforeEach(() => {
    eq.mockReset();
    order.mockReset();
    useEventMock.mockReset();
    eq.mockReturnValue({ order });
  });

  it('shows a placeholder while the event is still loading', () => {
    useEventMock.mockReturnValue({ event: null, loading: true, error: null });
    order.mockResolvedValue({ data: [], error: null });

    renderApp();

    expect(screen.getByText('…')).toBeInTheDocument();
  });

  it('renders the event title and the tent rows once both have loaded', async () => {
    useEventMock.mockReturnValue({ event: sampleEvent, loading: false, error: null });
    order.mockResolvedValue({ data: sampleTents, error: null });

    renderApp();

    expect(
      await screen.findByRole('heading', { name: /Kunstmeile 2026.*Tents/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Galerie Nord')).toBeInTheDocument();
    expect(screen.getByText('Atelier Süd')).toBeInTheDocument();
    expect(screen.getByText('galerie-nord')).toBeInTheDocument();
    expect(screen.getByText('atelier-sued')).toBeInTheDocument();
  });

  it('filters the tents query by event id and orders by name', async () => {
    useEventMock.mockReturnValue({ event: sampleEvent, loading: false, error: null });
    order.mockResolvedValue({ data: sampleTents, error: null });

    renderApp();
    await screen.findByText('Galerie Nord');

    expect(eq).toHaveBeenCalledWith('event_id', 'evt-1');
    expect(order).toHaveBeenCalledWith('name');
  });

  it('shows an empty-state row when there are no tents yet', async () => {
    useEventMock.mockReturnValue({ event: sampleEvent, loading: false, error: null });
    order.mockResolvedValue({ data: [], error: null });

    renderApp();

    expect(await screen.findByText(/no tents yet/i)).toBeInTheDocument();
  });

  it('links to the new-tent page and per-tent edit pages with correct slugs/ids', async () => {
    useEventMock.mockReturnValue({ event: sampleEvent, loading: false, error: null });
    order.mockResolvedValue({ data: sampleTents, error: null });

    renderApp();
    await screen.findByText('Galerie Nord');

    const newTentLink = screen.getByRole('link', { name: /new tent/i });
    expect(newTentLink).toHaveAttribute(
      'href',
      '/admin/events/kunstmeile-2026/tents/new',
    );

    const editLinks = screen.getAllByRole('link', { name: /edit/i });
    const editHrefs = editLinks.map((a) => a.getAttribute('href'));
    expect(editHrefs).toContain('/admin/events/kunstmeile-2026/tents/tent-a');
    expect(editHrefs).toContain('/admin/events/kunstmeile-2026/tents/tent-b');
  });

  it('does not query supabase until the event has loaded', async () => {
    useEventMock.mockReturnValue({ event: null, loading: true, error: null });
    order.mockResolvedValue({ data: [], error: null });

    renderApp();

    await waitFor(() => {
      expect(eq).not.toHaveBeenCalled();
      expect(order).not.toHaveBeenCalled();
    });
  });

  it('links each row to the public 3D view in a new tab via the event/tent permalink', async () => {
    useEventMock.mockReturnValue({ event: sampleEvent, loading: false, error: null });
    order.mockResolvedValue({ data: sampleTents, error: null });

    renderApp();
    await screen.findByText('Galerie Nord');

    const viewLinks = screen.getAllByRole('link', { name: /view 3d/i });
    const hrefs = viewLinks.map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/kunstmeile-2026/tent/galerie-nord');
    expect(hrefs).toContain('/kunstmeile-2026/tent/atelier-sued');

    // Opens in a new tab and is `noopener noreferrer` per security best
    // practice for target="_blank" links.
    for (const link of viewLinks) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    }
  });
});
