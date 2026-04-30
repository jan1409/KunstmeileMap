import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const { update, eq } = vi.hoisted(() => ({
  update: vi.fn(),
  eq: vi.fn(),
}));

vi.mock('../../../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({ update }),
  },
}));

const useEventMock = vi.fn();
vi.mock('../../../../src/hooks/useEvent', () => ({
  useEvent: (...args: unknown[]) => useEventMock(...args),
}));

import EventSettingsPage from '../../../../src/pages/admin/EventSettingsPage';

const sampleEvent = {
  id: 'evt-1',
  slug: 'kunstmeile-2026',
  title_de: 'Kunstmeile 2026',
  title_en: 'Kunstmeile 2026 EN',
  year: 2026,
  splat_url: 'https://example.com/scene.splat',
  status: 'published' as const,
  is_featured: true,
};

function renderApp() {
  return render(
    <MemoryRouter
      initialEntries={['/admin/events/kunstmeile-2026/settings']}
    >
      <Routes>
        <Route
          path="/admin/events/:eventSlug/settings"
          element={<EventSettingsPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('EventSettingsPage', () => {
  beforeEach(() => {
    update.mockReset();
    eq.mockReset().mockResolvedValue({ data: null, error: null });
    update.mockReturnValue({ eq });
    useEventMock.mockReset();

    useEventMock.mockReturnValue({
      event: sampleEvent,
      loading: false,
      error: null,
    });
  });

  it('populates the form from the loaded event', () => {
    renderApp();

    expect(screen.getByLabelText(/title \(de\)/i)).toHaveValue('Kunstmeile 2026');
    expect(screen.getByLabelText(/title \(en\)/i)).toHaveValue(
      'Kunstmeile 2026 EN',
    );
    expect(screen.getByLabelText(/splat url/i)).toHaveValue(
      'https://example.com/scene.splat',
    );
    expect(screen.getByLabelText(/^status$/i)).toHaveValue('published');
    expect(screen.getByLabelText(/featured/i)).toBeChecked();
  });

  it('exposes the three status options (draft, published, archived)', () => {
    renderApp();

    const select = screen.getByLabelText(/^status$/i) as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((o) => o.value);
    expect(optionValues).toEqual(['draft', 'published', 'archived']);
  });

  it('saves the current form values via supabase update, normalizing empty optional fields to null', async () => {
    const user = userEvent.setup();
    renderApp();

    // Edit a few fields.
    const titleEn = screen.getByLabelText(/title \(en\)/i);
    await user.clear(titleEn);
    // leave title_en empty → expect null in payload
    const splatUrl = screen.getByLabelText(/splat url/i);
    await user.clear(splatUrl);
    await user.type(splatUrl, 'https://new.example/scene.splat');
    await user.selectOptions(screen.getByLabelText(/^status$/i), 'archived');
    await user.click(screen.getByLabelText(/featured/i));

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update).toHaveBeenCalledWith({
      title_de: 'Kunstmeile 2026',
      title_en: null,
      splat_url: 'https://new.example/scene.splat',
      status: 'archived',
      is_featured: false,
    });
    expect(eq).toHaveBeenCalledWith('id', 'evt-1');
  });

  it('shows a "Saved" status message after a successful save', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText(/saved/i)).toBeInTheDocument();
  });

  it('surfaces the supabase error message when save fails (e.g. only_one_featured_event)', async () => {
    eq.mockResolvedValue({
      data: null,
      error: {
        message:
          'duplicate key value violates unique constraint "only_one_featured_event"',
      },
    });
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /only_one_featured_event/i,
    );
  });

  it('renders nothing while the event is still loading', () => {
    useEventMock.mockReturnValue({ event: null, loading: true, error: null });
    renderApp();

    expect(screen.queryByLabelText(/title \(de\)/i)).not.toBeInTheDocument();
  });
});
