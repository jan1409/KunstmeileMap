import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const { order } = vi.hoisted(() => ({ order: vi.fn() }));
vi.mock('../../../../src/lib/supabase', () => {
  const select = vi.fn().mockReturnValue({ order });
  return {
    supabase: {
      from: vi.fn().mockReturnValue({ select }),
    },
  };
});

// Stub the modal: render a marker + a stub "Created" button so we can drive
// the onCreated callback from the test without going through the real
// supabase.rpc path (which DuplicateEventModal owns and tests separately).
const modalProps: { current: Record<string, unknown> | null } = { current: null };
vi.mock('../../../../src/components/DuplicateEventModal', () => ({
  DuplicateEventModal: (props: Record<string, unknown>) => {
    modalProps.current = props;
    const source = props.source as { title_de: string };
    return (
      <div data-testid="duplicate-modal" data-source-title={source.title_de}>
        <button
          type="button"
          onClick={() => {
            (props.onCreated as (id: string) => void)('new-id');
            (props.onClose as () => void)();
          }}
        >
          stub-created
        </button>
        <button type="button" onClick={props.onClose as () => void}>
          stub-close
        </button>
      </div>
    );
  },
}));

import EventListPage from '../../../../src/pages/admin/EventListPage';

const sampleEvents = [
  {
    id: 'e1',
    slug: 'kunstmeile-2026',
    title_de: 'Kunstmeile 2026',
    title_en: null,
    year: 2026,
    status: 'published',
    is_featured: true,
  },
  {
    id: 'e2',
    slug: 'kunstmeile-2025',
    title_de: 'Kunstmeile 2025',
    title_en: null,
    year: 2025,
    status: 'archived',
    is_featured: false,
  },
];

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/admin/events']}>
      <Routes>
        <Route path="/admin/events" element={<EventListPage />} />
        <Route path="/admin/events/new" element={<div>new-event-page</div>} />
        <Route path="/admin/events/:slug/tents" element={<div>tent-list-page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('EventListPage', () => {
  beforeEach(() => {
    order.mockReset();
    modalProps.current = null;
  });

  it('lists events fetched from supabase, ordered by year descending', async () => {
    order.mockResolvedValue({ data: sampleEvents, error: null });
    renderApp();

    expect(await screen.findByText('Kunstmeile 2026')).toBeInTheDocument();
    expect(screen.getByText('Kunstmeile 2025')).toBeInTheDocument();
    expect(screen.getByText('2026')).toBeInTheDocument();
    expect(screen.getByText('2025')).toBeInTheDocument();
    expect(screen.getByText('published')).toBeInTheDocument();
    expect(screen.getByText('archived')).toBeInTheDocument();
    expect(order).toHaveBeenCalledWith('year', { ascending: false });
  });

  it('marks featured events with a star and leaves non-featured blank', async () => {
    order.mockResolvedValue({ data: sampleEvents, error: null });
    renderApp();

    const featuredRow = (await screen.findByText('Kunstmeile 2026')).closest('tr');
    const archivedRow = screen.getByText('Kunstmeile 2025').closest('tr');

    expect(featuredRow).not.toBeNull();
    expect(archivedRow).not.toBeNull();
    expect(featuredRow!.textContent).toContain('⭐');
    expect(archivedRow!.textContent).not.toContain('⭐');
  });

  it('links to the new-event page and to per-event tent management', async () => {
    order.mockResolvedValue({ data: sampleEvents, error: null });
    renderApp();

    await screen.findByText('Kunstmeile 2026');

    const newEventLink = screen.getByRole('link', { name: /new event/i });
    expect(newEventLink).toHaveAttribute('href', '/admin/events/new');

    const manageLinks = screen.getAllByRole('link', { name: /manage/i });
    expect(manageLinks[0]).toHaveAttribute('href', '/admin/events/kunstmeile-2026/tents');
    expect(manageLinks[1]).toHaveAttribute('href', '/admin/events/kunstmeile-2025/tents');
  });

  it('shows a loading indicator until data resolves', async () => {
    let resolveOrder: (value: { data: typeof sampleEvents; error: null }) => void = () => {};
    order.mockReturnValue(
      new Promise((resolve) => {
        resolveOrder = resolve;
      }),
    );

    renderApp();

    expect(screen.getByText('…')).toBeInTheDocument();

    resolveOrder({ data: sampleEvents, error: null });

    await waitFor(() => expect(screen.queryByText('…')).not.toBeInTheDocument());
    expect(screen.getByText('Kunstmeile 2026')).toBeInTheDocument();
  });

  it('opens the duplicate modal with the clicked event as source', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    order.mockResolvedValue({ data: sampleEvents, error: null });
    renderApp();
    await screen.findByText('Kunstmeile 2026');

    expect(screen.queryByTestId('duplicate-modal')).not.toBeInTheDocument();

    // Click the Duplicate button on the first row (Kunstmeile 2026).
    await user.click(screen.getAllByRole('button', { name: /duplicate/i })[0]!);

    const modal = await screen.findByTestId('duplicate-modal');
    expect(modal).toHaveAttribute('data-source-title', 'Kunstmeile 2026');
  });

  it('refetches the list after a successful duplicate and closes the modal', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    order.mockResolvedValue({ data: sampleEvents, error: null });
    renderApp();
    await screen.findByText('Kunstmeile 2026');
    expect(order).toHaveBeenCalledTimes(1);

    await user.click(screen.getAllByRole('button', { name: /duplicate/i })[0]!);
    await screen.findByTestId('duplicate-modal');

    // Drive onCreated via the stub button.
    await user.click(screen.getByRole('button', { name: /stub-created/i }));

    // Modal closes (page also drives onClose internally on success), and the
    // list re-fetches via the reloadTick effect.
    await waitFor(() =>
      expect(screen.queryByTestId('duplicate-modal')).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(order).toHaveBeenCalledTimes(2));
  });

  it('closes the modal without refetching when Cancel is clicked', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    order.mockResolvedValue({ data: sampleEvents, error: null });
    renderApp();
    await screen.findByText('Kunstmeile 2026');
    expect(order).toHaveBeenCalledTimes(1);

    await user.click(screen.getAllByRole('button', { name: /duplicate/i })[0]!);
    await screen.findByTestId('duplicate-modal');

    await user.click(screen.getByRole('button', { name: /stub-close/i }));

    await waitFor(() =>
      expect(screen.queryByTestId('duplicate-modal')).not.toBeInTheDocument(),
    );
    // No additional fetch — close path doesn't bump reloadTick.
    expect(order).toHaveBeenCalledTimes(1);
  });
});
