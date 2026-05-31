import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import '../../../../src/lib/i18n';

const { eq, order, deleteEq } = vi.hoisted(() => ({
  eq: vi.fn(),
  order: vi.fn(),
  deleteEq: vi.fn(),
}));

vi.mock('../../../../src/lib/supabase', () => {
  const select = vi.fn().mockReturnValue({ eq });
  const del = vi.fn().mockReturnValue({ eq: deleteEq });
  return {
    supabase: {
      from: vi.fn().mockReturnValue({ select, delete: del }),
    },
  };
});

const useEventMock = vi.fn();
vi.mock('../../../../src/hooks/useEvent', () => ({
  useEvent: (...args: unknown[]) => useEventMock(...args),
}));

// TentListPage uses ToastProvider for export-error reporting + delete
// success/error toasts — mock it minimally (same pattern as
// tests/unit/components/SidePanel.test.tsx).
const { showError, showSuccess } = vi.hoisted(() => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));
vi.mock('../../../../src/components/ToastProvider', () => ({
  useToast: () => ({ showError, showSuccess }),
}));

vi.mock('../../../../src/hooks/useEventPermissions', () => ({
  useEventPermissions: vi.fn(),
}));

import TentListPage from '../../../../src/pages/admin/TentListPage';
import { useEventPermissions } from '../../../../src/hooks/useEventPermissions';

const sampleEvent = {
  id: 'evt-1',
  slug: 'kunstmeile-2026',
  title_de: 'Kunstmeile 2026',
  title_en: null,
  year: 2026,
  status: 'published',
  is_featured: true,
};

// Two rows pre-sorted by display_number ascending (the order the page now
// requests). Numbered out-of-creation-order to verify the sort key changed.
const sampleTents = [
  {
    id: 'tent-b',
    event_id: 'evt-1',
    slug: 'atelier-sued',
    name: 'Atelier Süd',
    display_number: 1,
    lat: null,
    lng: null,
  },
  {
    id: 'tent-a',
    event_id: 'evt-1',
    slug: 'galerie-nord',
    name: 'Galerie Nord',
    display_number: 2,
    lat: null,
    lng: null,
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
    deleteEq.mockReset();
    useEventMock.mockReset();
    showError.mockReset();
    showSuccess.mockReset();
    eq.mockReturnValue({ order });
    deleteEq.mockResolvedValue({ error: null });
    // Default to editor-level perms so the pre-existing tests (which assert
    // + Neuer Stand is visible) keep passing without modification.
    vi.mocked(useEventPermissions).mockReturnValue({
      loading: false,
      canAccess: true,
      canContribute: true,
      canEdit: true,
      canOwn: false,
    });
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
      await screen.findByRole('heading', { name: /Kunstmeile 2026.*(Tents|Stände)/i }),
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
    expect(order).toHaveBeenCalledWith('display_number', {
      ascending: true,
      nullsFirst: false,
    });
  });

  it('renders a # column showing display_number for each row', async () => {
    useEventMock.mockReturnValue({ event: sampleEvent, loading: false, error: null });
    order.mockResolvedValue({ data: sampleTents, error: null });

    renderApp();
    await screen.findByText('Galerie Nord');

    expect(screen.getByRole('columnheader', { name: '#' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '2' })).toBeInTheDocument();
  });

  it('shows an empty-state row when there are no tents yet', async () => {
    useEventMock.mockReturnValue({ event: sampleEvent, loading: false, error: null });
    order.mockResolvedValue({ data: [], error: null });

    renderApp();

    expect(await screen.findByText(/no tents yet|Noch keine Stände/i)).toBeInTheDocument();
  });

  it('links to the new-tent page and per-tent edit pages with correct slugs/ids', async () => {
    useEventMock.mockReturnValue({ event: sampleEvent, loading: false, error: null });
    order.mockResolvedValue({ data: sampleTents, error: null });

    renderApp();
    await screen.findByText('Galerie Nord');

    const newTentLink = screen.getByRole('link', { name: /new tent|Neuer Stand/i });
    expect(newTentLink).toHaveAttribute(
      'href',
      '/admin/events/kunstmeile-2026/tents/new',
    );

    const editLinks = screen.getAllByRole('link', { name: /edit|Bearbeiten/i });
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

  it('links each row to the public view in a new tab via the event/tent permalink', async () => {
    useEventMock.mockReturnValue({ event: sampleEvent, loading: false, error: null });
    order.mockResolvedValue({ data: sampleTents, error: null });

    renderApp();
    await screen.findByText('Galerie Nord');

    const viewLinks = screen.getAllByRole('link', { name: /^view$|^Ansehen$/i });
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

  it('hides + Neuer Stand and CSV-Import buttons for a contributor', async () => {
    useEventMock.mockReturnValue({ event: sampleEvent, loading: false, error: null });
    order.mockResolvedValue({ data: sampleTents, error: null });
    vi.mocked(useEventPermissions).mockReturnValue({
      loading: false,
      canAccess: true,
      canContribute: true,
      canEdit: false,
      canOwn: false,
    });

    renderApp();
    await screen.findByText('Galerie Nord');

    expect(
      screen.queryByRole('link', { name: /Neuer Stand|New tent/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /CSV-Import|CSV import/i }),
    ).not.toBeInTheDocument();
  });

  it('shows both buttons for an editor', async () => {
    useEventMock.mockReturnValue({ event: sampleEvent, loading: false, error: null });
    order.mockResolvedValue({ data: sampleTents, error: null });
    vi.mocked(useEventPermissions).mockReturnValue({
      loading: false,
      canAccess: true,
      canContribute: true,
      canEdit: true,
      canOwn: false,
    });

    renderApp();
    await screen.findByText('Galerie Nord');

    expect(
      screen.getByRole('link', { name: /Neuer Stand|New tent/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /CSV-Import|CSV import/i }),
    ).toBeInTheDocument();
  });

  it('shows a Löschen button on each row for an editor and hides it for a contributor', async () => {
    useEventMock.mockReturnValue({ event: sampleEvent, loading: false, error: null });
    order.mockResolvedValue({ data: sampleTents, error: null });

    const { unmount } = renderApp();
    await screen.findByText('Galerie Nord');

    const editorDeleteButtons = screen.getAllByRole('button', {
      name: /^Löschen$|^Delete$/i,
    });
    expect(editorDeleteButtons.length).toBe(sampleTents.length);
    unmount();

    vi.mocked(useEventPermissions).mockReturnValue({
      loading: false,
      canAccess: true,
      canContribute: true,
      canEdit: false,
      canOwn: false,
    });

    renderApp();
    await screen.findByText('Galerie Nord');

    expect(
      screen.queryByRole('button', { name: /^Löschen$|^Delete$/i }),
    ).not.toBeInTheDocument();
  });

  it('deletes a tent via two-click confirm and shows a success toast', async () => {
    useEventMock.mockReturnValue({ event: sampleEvent, loading: false, error: null });
    order.mockResolvedValue({ data: sampleTents, error: null });

    renderApp();
    await screen.findByText('Galerie Nord');

    // First row in display_number order is tent-b (Atelier Süd, #1).
    const rowDeleteButtons = screen.getAllByRole('button', {
      name: /^Löschen$|^Delete$/i,
    });
    const firstDeleteButton = rowDeleteButtons[0];
    if (!firstDeleteButton) throw new Error('expected at least one delete button');
    fireEvent.click(firstDeleteButton);

    // After first click, that button becomes the confirm-state button.
    expect(deleteEq).not.toHaveBeenCalled();
    const confirmBtn = await screen.findByRole('button', {
      name: /Klick zum Bestätigen|Click to confirm/i,
    });

    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(deleteEq).toHaveBeenCalledWith('id', 'tent-b');
    });
    expect(showSuccess).toHaveBeenCalled();
  });

  it('hides the bulk-delete button when there are no tents', async () => {
    useEventMock.mockReturnValue({ event: sampleEvent, loading: false, error: null });
    order.mockResolvedValue({ data: [], error: null });

    renderApp();
    await screen.findByText(/no tents yet|Noch keine Stände/i);

    expect(
      screen.queryByRole('button', { name: /Alle Stände löschen|Delete all tents/i }),
    ).not.toBeInTheDocument();
  });

  it('requires the event slug to enable the bulk-delete submit button', async () => {
    useEventMock.mockReturnValue({ event: sampleEvent, loading: false, error: null });
    order.mockResolvedValue({ data: sampleTents, error: null });

    renderApp();
    await screen.findByText('Galerie Nord');

    fireEvent.click(
      screen.getByRole('button', { name: /Alle Stände löschen|Delete all tents/i }),
    );

    const dialog = await screen.findByRole('dialog');
    const submitBtn = screen.getByRole('button', {
      name: /Endgültig löschen|Permanently delete/i,
    });
    expect(submitBtn).toBeDisabled();

    const input = dialog.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input).toBeTruthy();

    fireEvent.change(input, { target: { value: 'wrong-slug' } });
    expect(submitBtn).toBeDisabled();

    fireEvent.change(input, { target: { value: 'kunstmeile-2026' } });
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(deleteEq).toHaveBeenCalledWith('event_id', 'evt-1');
    });
  });

  it('closes the bulk-delete modal without deleting when cancel is clicked', async () => {
    useEventMock.mockReturnValue({ event: sampleEvent, loading: false, error: null });
    order.mockResolvedValue({ data: sampleTents, error: null });

    renderApp();
    await screen.findByText('Galerie Nord');

    fireEvent.click(
      screen.getByRole('button', { name: /Alle Stände löschen|Delete all tents/i }),
    );

    await screen.findByRole('dialog');

    fireEvent.click(
      screen.getByRole('button', { name: /^Abbrechen$|^Cancel$/i }),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(deleteEq).not.toHaveBeenCalled();
  });
});
