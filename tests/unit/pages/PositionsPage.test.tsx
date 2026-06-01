import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import i18n from '../../../src/lib/i18n';

// Shared supabase mock — overridden per test for update behavior.
const supabaseUpdate = vi.fn();
const supabaseEq = vi.fn();

vi.mock('../../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: (payload: unknown) => {
        supabaseUpdate(payload);
        return {
          eq: (col: string, val: string) => {
            supabaseEq(col, val);
            return supabaseEq.mock.results[supabaseEq.mock.calls.length - 1]?.value
              ?? Promise.resolve({ data: null, error: null });
          },
        };
      },
    })),
  },
}));

// Use real hooks but stub their data via module mocks.
vi.mock('../../../src/hooks/useEvent', () => ({
  useEvent: () => ({
    event: {
      id: 'evt-1',
      slug: 'evt-1',
      title_de: 'Test',
      default_lat: 53.27,
      default_lng: 9.5,
      default_zoom: 18,
    },
    loading: false,
    error: null,
  }),
}));

const tentsState = {
  current: [
    { id: 'a', name: 'Alpha', display_number: 1, lat: 53.1, lng: 9.1, categories: [] },
    { id: 'b', name: 'Bravo', display_number: 2, lat: 53.2, lng: 9.2, categories: [] },
    { id: 'c', name: 'Charlie', display_number: 3, lat: null, lng: null, categories: [] },
  ],
};

vi.mock('../../../src/hooks/useTents', () => ({
  useTents: () => ({ tents: tentsState.current, loading: false, error: null }),
}));

vi.mock('../../../src/hooks/useEventPermissions', () => ({
  useEventPermissions: () => ({
    loading: false,
    canAccess: true,
    canContribute: true,
    canEdit: true,
    canOwn: false,
  }),
}));

vi.mock('../../../src/hooks/useTileStyle', () => ({
  useTileStyle: () => ['osm', vi.fn()],
}));

// PositionsMap brings in leaflet; replace with a minimal stub that exposes the
// drag handler and dirty flag via the DOM. The page test only cares about the
// page logic.
vi.mock('../../../src/components/PositionsMap', () => {
  return {
    PositionsMap: ({
      tents,
      dirtyIds,
      onPositionChange,
    }: {
      tents: Array<{ id: string; name: string; lat: number; lng: number }>;
      dirtyIds: Set<string>;
      onPositionChange: (id: string, lat: number, lng: number) => void;
    }) => (
      <div data-testid="positions-map">
        {tents.map((t) => (
          <button
            key={t.id}
            data-testid={`drag-${t.id}`}
            data-dirty={dirtyIds.has(t.id) ? 'true' : 'false'}
            data-lat={t.lat}
            data-lng={t.lng}
            onClick={() => onPositionChange(t.id, t.lat + 0.001, t.lng + 0.001)}
          >
            drag {t.name}
          </button>
        ))}
      </div>
    ),
  };
});

// ToastProvider context — give the page a real provider.
import { ToastProvider } from '../../../src/components/ToastProvider';
import PositionsPage from '../../../src/pages/admin/PositionsPage';

beforeEach(() => {
  supabaseUpdate.mockClear();
  supabaseEq.mockClear();
  // Default each update().eq() resolves OK.
  supabaseEq.mockImplementation(() => Promise.resolve({ data: null, error: null }));
});

afterEach(() => {
  vi.clearAllMocks();
});

function renderPage() {
  const router = createMemoryRouter(
    [
      {
        path: '/admin/events/:eventSlug/positions',
        element: <PositionsPage />,
      },
    ],
    { initialEntries: ['/admin/events/evt-1/positions'] },
  );
  return render(
    <I18nextProvider i18n={i18n}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </I18nextProvider>,
  );
}

describe('PositionsPage', () => {
  it('renders the side list with placed + unplaced sections', () => {
    renderPage();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Bravo')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });

  it('save button is disabled when no edits exist', () => {
    renderPage();
    const btn = screen.getByRole('button', {
      name: /save changes \(0\)|änderungen speichern \(0\)/i,
    });
    expect(btn).toBeDisabled();
  });

  it('dragging a marker enables the save button and increments the dirty count', async () => {
    renderPage();
    await userEvent.click(screen.getByTestId('drag-a'));
    const btn = screen.getByRole('button', {
      name: /save changes \(1\)|änderungen speichern \(1\)/i,
    });
    expect(btn).toBeEnabled();
  });

  it('save fires one supabase update().eq() per dirty tent with the new coords', async () => {
    renderPage();
    await userEvent.click(screen.getByTestId('drag-a'));
    await userEvent.click(screen.getByTestId('drag-b'));
    const btn = screen.getByRole('button', {
      name: /save changes \(2\)|änderungen speichern \(2\)/i,
    });
    await userEvent.click(btn);
    await waitFor(() => {
      expect(supabaseUpdate).toHaveBeenCalledTimes(2);
      expect(supabaseEq).toHaveBeenCalledTimes(2);
    });
    // Verify each update payload carries {lat, lng}.
    const payloads = supabaseUpdate.mock.calls.map((c) => c[0]);
    for (const p of payloads) {
      expect(p).toHaveProperty('lat');
      expect(p).toHaveProperty('lng');
    }
  });

  it('save success clears dirty state and shows a success toast', async () => {
    renderPage();
    await userEvent.click(screen.getByTestId('drag-a'));
    await userEvent.click(
      screen.getByRole('button', {
        name: /save changes \(1\)|änderungen speichern \(1\)/i,
      }),
    );
    await waitFor(() => {
      expect(
        screen.getByText(/1 positions saved|1 positionen gespeichert/i),
      ).toBeInTheDocument();
    });
    const btnAfter = screen.getByRole('button', {
      name: /save changes \(0\)|änderungen speichern \(0\)/i,
    });
    expect(btnAfter).toBeDisabled();
  });

  it('save partial failure: failed tent stays dirty, error toast shows partial summary', async () => {
    // Make Alpha fail, Bravo succeed. The mock keys by call order.
    let callIdx = 0;
    supabaseEq.mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) {
        return Promise.resolve({ data: null, error: { message: 'boom' } });
      }
      return Promise.resolve({ data: null, error: null });
    });
    renderPage();
    await userEvent.click(screen.getByTestId('drag-a'));
    await userEvent.click(screen.getByTestId('drag-b'));
    await userEvent.click(
      screen.getByRole('button', {
        name: /save changes \(2\)|änderungen speichern \(2\)/i,
      }),
    );
    await waitFor(() => {
      // 1 of 2 saved, 1 failed.
      expect(
        screen.getByText(
          /1 of 2 saved\. 1 failed: boom|1 von 2 gespeichert\. 1 fehlgeschlagen: boom/i,
        ),
      ).toBeInTheDocument();
    });
    // One tent stays dirty after partial failure.
    const btnAfter = screen.getByRole('button', {
      name: /save changes \(1\)|änderungen speichern \(1\)/i,
    });
    expect(btnAfter).toBeEnabled();
  });

  it('marker stays at the saved position after a successful save (no jump-back)', async () => {
    const { getByTestId } = renderPage();
    // Pre-drag: Alpha at the seed coords.
    const preLat = parseFloat(getByTestId('drag-a').getAttribute('data-lat')!);
    // Drag Alpha (+0.001) and save.
    await userEvent.click(getByTestId('drag-a'));
    await userEvent.click(
      screen.getByRole('button', {
        name: /save changes \(1\)|änderungen speichern \(1\)/i,
      }),
    );
    await waitFor(() => {
      expect(getByTestId('drag-a').getAttribute('data-dirty')).toBe('false');
    });
    // After save, the marker stays at the post-drag coord, NOT the pre-drag coord.
    const postLat = parseFloat(getByTestId('drag-a').getAttribute('data-lat')!);
    expect(postLat).toBeCloseTo(preLat + 0.001, 6);
  });

  it('discard-all opens confirm and clears every edit on confirm', async () => {
    renderPage();
    await userEvent.click(screen.getByTestId('drag-a'));
    await userEvent.click(screen.getByTestId('drag-b'));
    await userEvent.click(
      screen.getByRole('button', { name: /discard all|alle verwerfen/i }),
    );
    // Modal "Discard"/"Verwerfen" submit button.
    await userEvent.click(
      screen.getByRole('button', { name: /^discard$|^verwerfen$/i }),
    );
    const btn = screen.getByRole('button', {
      name: /save changes \(0\)|änderungen speichern \(0\)/i,
    });
    expect(btn).toBeDisabled();
  });
});
