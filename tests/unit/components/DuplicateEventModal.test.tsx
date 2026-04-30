import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const rpcFn = vi.hoisted(() => vi.fn());
vi.mock('../../../src/lib/supabase', () => ({
  supabase: { rpc: rpcFn },
}));

import { DuplicateEventModal } from '../../../src/components/DuplicateEventModal';

const sourceEvent = {
  id: 'evt-2026',
  slug: 'kunstmeile-2026',
  title_de: 'Kunstmeile 2026',
  title_en: null,
  year: 2026,
  starts_at: null,
  ends_at: null,
  venue_name: null,
  venue_address: null,
  splat_url: null,
  splat_origin: null,
  splat_camera_default: null,
  status: 'published' as const,
  is_featured: true,
  created_at: '2026-04-01T00:00:00Z',
  updated_at: '2026-04-01T00:00:00Z',
};

describe('DuplicateEventModal', () => {
  const onClose = vi.fn<() => void>();
  const onCreated = vi.fn<(newEventId: string) => void>();

  beforeEach(() => {
    rpcFn.mockReset();
    onClose.mockReset();
    onCreated.mockReset();
  });

  it('seeds the form with sensible defaults derived from the source event', () => {
    render(
      <DuplicateEventModal
        source={sourceEvent}
        onClose={onClose}
        onCreated={onCreated}
      />,
    );

    expect(screen.getByLabelText(/^slug$/i)).toHaveValue('kunstmeile-2026-copy');
    expect(screen.getByLabelText(/title \(de\)/i)).toHaveValue(
      'Kunstmeile 2026 (Kopie)',
    );
    expect(screen.getByLabelText(/^year$/i)).toHaveValue(2027);
  });

  it('renders the source title in the heading', () => {
    render(
      <DuplicateEventModal
        source={sourceEvent}
        onClose={onClose}
        onCreated={onCreated}
      />,
    );

    expect(
      screen.getByRole('heading', { name: /Kunstmeile 2026/i }),
    ).toBeInTheDocument();
  });

  it('disables "Clone tent positions" when "Clone tents" is unchecked', async () => {
    const user = userEvent.setup();
    render(
      <DuplicateEventModal
        source={sourceEvent}
        onClose={onClose}
        onCreated={onCreated}
      />,
    );

    const cloneTents = screen.getByLabelText(/clone tents/i);
    const clonePositions = screen.getByLabelText(/clone tent positions/i);

    expect(clonePositions).not.toBeDisabled();

    await user.click(cloneTents);

    expect(clonePositions).toBeDisabled();
  });

  it('calls duplicate_event with the form values, then onCreated + onClose on success', async () => {
    rpcFn.mockResolvedValue({ data: 'new-uuid', error: null });
    const user = userEvent.setup();
    render(
      <DuplicateEventModal
        source={sourceEvent}
        onClose={onClose}
        onCreated={onCreated}
      />,
    );

    // Tweak the slug + year to verify form-state is what gets sent.
    const slug = screen.getByLabelText(/^slug$/i);
    await user.clear(slug);
    await user.type(slug, 'kunstmeile-2027');
    const year = screen.getByLabelText(/^year$/i);
    await user.clear(year);
    await user.type(year, '2027');

    // Flip clone_tent_positions off so we know our checkbox state lands.
    await user.click(screen.getByLabelText(/clone tent positions/i));

    await user.click(screen.getByRole('button', { name: /^duplicate$/i }));

    await waitFor(() => expect(rpcFn).toHaveBeenCalledTimes(1));
    expect(rpcFn).toHaveBeenCalledWith('duplicate_event', {
      source_event_id: 'evt-2026',
      new_slug: 'kunstmeile-2027',
      new_title_de: 'Kunstmeile 2026 (Kopie)',
      new_year: 2027,
      clone_categories: true,
      clone_tents: true,
      clone_tent_positions: false,
      clone_splat_url: true,
    });
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('surfaces the rpc error and does NOT call onCreated/onClose when duplicate fails', async () => {
    rpcFn.mockResolvedValue({
      data: null,
      error: { message: 'permission denied' },
    });
    const user = userEvent.setup();
    render(
      <DuplicateEventModal
        source={sourceEvent}
        onClose={onClose}
        onCreated={onCreated}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^duplicate$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/permission denied/i);
    expect(onCreated).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose without invoking rpc when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(
      <DuplicateEventModal
        source={sourceEvent}
        onClose={onClose}
        onCreated={onCreated}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(rpcFn).not.toHaveBeenCalled();
  });
});
