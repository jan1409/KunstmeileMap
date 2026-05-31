import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import '../../../../src/lib/i18n';

const { listOrder, insertCat, deleteEq, updateEq, upsertCat } = vi.hoisted(() => ({
  listOrder: vi.fn(),
  insertCat: vi.fn(),
  deleteEq: vi.fn(),
  updateEq: vi.fn(),
  upsertCat: vi.fn(),
}));

vi.mock('../../../../src/lib/supabase', () => {
  // list:   from('categories').select('*').eq('event_id', X).order('display_order', { ascending: true })
  // insert: from('categories').insert({...})
  // delete: from('categories').delete().eq('id', X)
  // update: from('categories').update({...}).eq('id', X)
  // upsert: from('categories').upsert([...], {...})  (used by import modal — list-fetch hits .eq instead)
  const listEq = vi.fn().mockReturnValue({ order: listOrder });
  const select = vi.fn().mockReturnValue({ eq: listEq });
  const deleteSelf = vi.fn().mockReturnValue({ eq: deleteEq });
  const updateSelf = vi.fn().mockReturnValue({ eq: updateEq });
  return {
    supabase: {
      from: vi.fn().mockReturnValue({
        select,
        insert: insertCat,
        delete: deleteSelf,
        update: updateSelf,
        upsert: upsertCat,
      }),
    },
  };
});

const useEventMock = vi.fn();
vi.mock('../../../../src/hooks/useEvent', () => ({
  useEvent: (...args: unknown[]) => useEventMock(...args),
}));

// CategoryListPage uses ToastProvider for export-error reporting — mock it minimally
// (same pattern as tests/unit/components/SidePanel.test.tsx).
vi.mock('../../../../src/components/ToastProvider', () => ({
  useToast: () => ({ showError: vi.fn(), showSuccess: vi.fn() }),
}));

import CategoryListPage from '../../../../src/pages/admin/CategoryListPage';

const sampleEvent = {
  id: 'evt-1',
  slug: 'kunstmeile-2026',
  title_de: 'Kunstmeile 2026',
};

const sampleCategories = [
  {
    id: 'c1',
    event_id: 'evt-1',
    slug: 'galerie',
    name_de: 'Galerie',
    name_en: 'Gallery',
    icon: '🎨',
    display_order: 0,
  },
  {
    id: 'c2',
    event_id: 'evt-1',
    slug: 'atelier',
    name_de: 'Atelier',
    name_en: 'Studio',
    icon: '🖌️',
    display_order: 1,
  },
];

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/admin/events/kunstmeile-2026/categories']}>
      <Routes>
        <Route
          path="/admin/events/:eventSlug/categories"
          element={<CategoryListPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CategoryListPage', () => {
  beforeEach(() => {
    listOrder.mockReset();
    insertCat.mockReset();
    deleteEq.mockReset();
    updateEq.mockReset();
    upsertCat.mockReset();
    useEventMock.mockReset();

    useEventMock.mockReturnValue({
      event: sampleEvent,
      loading: false,
      error: null,
    });
    listOrder.mockResolvedValue({ data: sampleCategories, error: null });
    insertCat.mockResolvedValue({ data: null, error: null });
    deleteEq.mockResolvedValue({ data: null, error: null });
    updateEq.mockResolvedValue({ data: null, error: null });
    upsertCat.mockResolvedValue({ data: null, error: null });
  });

  it('lists the existing categories sorted by display_order', async () => {
    renderApp();

    expect(await screen.findByText('Galerie')).toBeInTheDocument();
    expect(screen.getByText('Atelier')).toBeInTheDocument();
    expect(screen.getByText('🎨')).toBeInTheDocument();
    expect(screen.getByText('🖌️')).toBeInTheDocument();
    expect(screen.getByText('Gallery')).toBeInTheDocument();
    expect(screen.getByText('Studio')).toBeInTheDocument();
    expect(listOrder).toHaveBeenCalledWith('display_order', { ascending: true });
  });

  it('reveals an inline form when "+ New category" is clicked', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('Galerie');

    expect(screen.queryByLabelText(/^slug$/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /new category|Neue Kategorie/i }));

    expect(screen.getByLabelText(/^slug$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/name \(de\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/name \(en\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/icon/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/order|Reihenfolge/i)).toBeInTheDocument();
  });

  it('inserts a new category with the next display_order and refreshes the list', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('Galerie');
    expect(listOrder).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /new category|Neue Kategorie/i }));

    await user.type(screen.getByLabelText(/^slug$/i), 'food');
    await user.type(screen.getByLabelText(/name \(de\)/i), 'Essen');
    await user.type(screen.getByLabelText(/name \(en\)/i), 'Food');
    await user.type(screen.getByLabelText(/icon/i), '🍞');

    await user.click(screen.getByRole('button', { name: /^save$|^Speichern$/i }));

    await waitFor(() => expect(insertCat).toHaveBeenCalledTimes(1));
    expect(insertCat).toHaveBeenCalledWith({
      event_id: 'evt-1',
      slug: 'food',
      name_de: 'Essen',
      name_en: 'Food',
      icon: '🍞',
      display_order: 2,
    });
    await waitFor(() => expect(listOrder).toHaveBeenCalledTimes(2));
    // Form is hidden again after a successful save.
    expect(screen.queryByLabelText(/^slug$/i)).not.toBeInTheDocument();
  });

  it('respects a manually-entered display_order on create', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('Galerie');

    await user.click(screen.getByRole('button', { name: /new category|Neue Kategorie/i }));

    const orderInput = screen.getByLabelText(/order|Reihenfolge/i);
    await user.clear(orderInput);
    await user.type(orderInput, '7');
    await user.type(screen.getByLabelText(/^slug$/i), 'food');
    await user.type(screen.getByLabelText(/name \(de\)/i), 'Essen');

    await user.click(screen.getByRole('button', { name: /^save$|^Speichern$/i }));

    await waitFor(() => expect(insertCat).toHaveBeenCalledTimes(1));
    expect(insertCat.mock.calls[0]![0]).toMatchObject({ display_order: 7 });
  });

  it('hides the form again when Cancel is clicked', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('Galerie');

    await user.click(screen.getByRole('button', { name: /new category|Neue Kategorie/i }));
    expect(screen.getByLabelText(/^slug$/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^cancel$|^Abbrechen$/i }));

    expect(screen.queryByLabelText(/^slug$/i)).not.toBeInTheDocument();
    expect(insertCat).not.toHaveBeenCalled();
  });

  it('requires confirmation before deleting a category', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('Galerie');

    // First click: enter confirm mode for the first row.
    await user.click(screen.getAllByRole('button', { name: /^delete$|^Löschen$/i })[0]!);
    expect(deleteEq).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /confirm delete|Löschen bestätigen/i })).toBeInTheDocument();

    // Confirm: actually delete.
    await user.click(screen.getByRole('button', { name: /confirm delete|Löschen bestätigen/i }));

    await waitFor(() => expect(deleteEq).toHaveBeenCalledWith('id', 'c1'));
    await waitFor(() => expect(listOrder).toHaveBeenCalledTimes(2));
  });

  it('lets the user back out of a delete confirmation', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('Galerie');

    await user.click(screen.getAllByRole('button', { name: /^delete$|^Löschen$/i })[0]!);
    expect(screen.getByRole('button', { name: /confirm delete|Löschen bestätigen/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^cancel$|^Abbrechen$/i }));

    expect(deleteEq).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: /confirm delete|Löschen bestätigen/i }),
    ).not.toBeInTheDocument();
  });

  it('renders an empty-state row when there are no categories yet', async () => {
    listOrder.mockResolvedValue({ data: [], error: null });
    renderApp();

    expect(await screen.findByText(/no categories yet|Noch keine Kategorien/i)).toBeInTheDocument();
  });

  it('shows an Edit button on every row', async () => {
    renderApp();
    await screen.findByText('Galerie');
    const editButtons = screen.getAllByRole('button', { name: /^edit$|^Bearbeiten$/i });
    expect(editButtons).toHaveLength(2);
  });

  it('pre-fills the form and switches submit-label to "Save (update)" on Edit click', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('Galerie');

    const editButtons = screen.getAllByRole('button', { name: /^edit$|^Bearbeiten$/i });
    await user.click(editButtons[0]!);

    expect(screen.getByLabelText(/^slug$/i)).toHaveValue('galerie');
    expect(screen.getByLabelText(/name \(de\)/i)).toHaveValue('Galerie');
    expect(screen.getByLabelText(/name \(en\)/i)).toHaveValue('Gallery');
    expect(screen.getByLabelText(/icon/i)).toHaveValue('🎨');
    expect(screen.getByLabelText(/order|Reihenfolge/i)).toHaveValue(0);
    // Both create-save and update-save use the "Save" / "Speichern" label per spec.
    expect(
      screen.getByRole('button', { name: /^save$|^Speichern$/i }),
    ).toBeInTheDocument();
  });

  it('submitting the edit form calls supabase.update with the right id', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('Galerie');

    const editButtons = screen.getAllByRole('button', { name: /^edit$|^Bearbeiten$/i });
    await user.click(editButtons[0]!);

    const nameDe = screen.getByLabelText(/name \(de\)/i);
    await user.clear(nameDe);
    await user.type(nameDe, 'Galerien');

    await user.click(screen.getByRole('button', { name: /^save$|^Speichern$/i }));

    await waitFor(() => expect(updateEq).toHaveBeenCalledTimes(1));
    expect(updateEq).toHaveBeenCalledWith('id', 'c1');
    expect(insertCat).not.toHaveBeenCalled();
    await waitFor(() => expect(listOrder).toHaveBeenCalledTimes(2));
  });

  it('clicking Delete on a row cancels an open edit form', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('Galerie');

    // Open edit on row 1.
    const editButtons = screen.getAllByRole('button', { name: /^edit$|^Bearbeiten$/i });
    await user.click(editButtons[0]!);
    expect(screen.getByLabelText(/^slug$/i)).toBeInTheDocument();

    // Click Delete on row 2 — should close the form.
    const deleteButtons = screen.getAllByRole('button', { name: /^delete$|^Löschen$/i });
    await user.click(deleteButtons[1]!);

    expect(screen.queryByLabelText(/^slug$/i)).not.toBeInTheDocument();
  });
});
