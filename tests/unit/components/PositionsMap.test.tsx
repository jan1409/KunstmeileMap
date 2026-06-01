import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { PositionsMap, type PositionsMapTent } from '../../../src/components/PositionsMap';

interface MockMap {
  flyTo: ReturnType<typeof vi.fn>;
  getZoom: ReturnType<typeof vi.fn>;
}

function makeMockMap(): MockMap {
  return {
    flyTo: vi.fn(),
    getZoom: vi.fn(() => 18),
  };
}

// Shared map instance for useMap()-based components in the test.
const g = globalThis as unknown as {
  __mockMap?: MockMap;
  __markerDragHandlers?: Record<string, (latlng: { lat: number; lng: number }) => void>;
};

vi.mock('react-leaflet', () => ({
  MapContainer: ({
    children,
    center,
    zoom,
  }: {
    children?: React.ReactNode;
    center: [number, number];
    zoom: number;
  }) => (
    <div data-testid="map" data-center={JSON.stringify(center)} data-zoom={zoom}>
      {children}
    </div>
  ),
  TileLayer: ({ url }: { url?: string }) => (
    <div data-testid="tile-layer" data-url={url ?? ''} />
  ),
  ZoomControl: () => <div data-testid="zoom-control" />,
  Marker: ({
    position,
    icon,
    draggable,
    title,
    eventHandlers,
  }: {
    position: [number, number];
    icon?: { options?: { html?: string } };
    draggable?: boolean;
    title?: string;
    eventHandlers?: { dragend?: (e: { target: { getLatLng: () => { lat: number; lng: number } } }) => void };
  }) => {
    // Surface dirty styling: PositionsMap encodes "dirty" by including the
    // class `marker-dirty` in the icon HTML. Tests assert on data-dirty.
    const html = icon?.options?.html ?? '';
    const isDirty = html.includes('marker-dirty');
    // Register a drag handler keyed by stringified position so tests can
    // synthesize a dragend.
    if (eventHandlers?.dragend) {
      g.__markerDragHandlers = g.__markerDragHandlers ?? {};
      g.__markerDragHandlers[title ?? ''] = (latlng) =>
        eventHandlers.dragend!({
          target: { getLatLng: () => latlng },
        });
    }
    return (
      <div
        data-testid="marker"
        data-position={JSON.stringify(position)}
        data-draggable={draggable ? 'true' : 'false'}
        data-dirty={isDirty ? 'true' : 'false'}
        data-title={title ?? ''}
      />
    );
  },
  useMap: () => {
    if (!g.__mockMap) g.__mockMap = makeMockMap();
    return g.__mockMap;
  },
  useMapEvents: () => ({
    getZoom: () => 18,
  }),
}));

vi.mock('leaflet', () => ({
  default: {
    divIcon: (opts: { html?: string }) => ({ options: opts }),
    latLng: (lat: number, lng: number) => ({ lat, lng }),
  },
}));

vi.mock('leaflet/dist/leaflet.css', () => ({}));

// MapStyleToggle uses i18n; mock minimally to keep this test focused.
vi.mock('../../../src/components/MapStyleToggle', () => ({
  MapStyleToggle: () => <div data-testid="style-toggle" />,
}));

const SAMPLE: PositionsMapTent[] = [
  { id: 'a', name: 'Alpha', display_number: 1, lat: 53.1, lng: 9.1 },
  { id: 'b', name: 'Bravo', display_number: 2, lat: 53.2, lng: 9.2 },
];

beforeEach(() => {
  g.__mockMap = makeMockMap();
  g.__markerDragHandlers = {};
});

describe('PositionsMap', () => {
  function renderMap(
    overrides: Partial<React.ComponentProps<typeof PositionsMap>> = {},
  ) {
    const defaults: React.ComponentProps<typeof PositionsMap> = {
      tents: SAMPLE,
      dirtyIds: new Set<string>(),
      focusTentId: null,
      canEdit: true,
      tileStyle: 'osm',
      onTileStyleChange: vi.fn(),
      onPositionChange: vi.fn(),
      defaultCenter: [53.0, 9.0],
      defaultZoom: 18,
    };
    return render(<PositionsMap {...defaults} {...overrides} />);
  }

  it('renders one marker per placed tent', () => {
    const { getAllByTestId } = renderMap();
    expect(getAllByTestId('marker')).toHaveLength(2);
  });

  it('markers are draggable when canEdit=true', () => {
    const { getAllByTestId } = renderMap();
    for (const m of getAllByTestId('marker')) {
      expect(m).toHaveAttribute('data-draggable', 'true');
    }
  });

  it('markers are NOT draggable when canEdit=false', () => {
    const { getAllByTestId } = renderMap({ canEdit: false });
    for (const m of getAllByTestId('marker')) {
      expect(m).toHaveAttribute('data-draggable', 'false');
    }
  });

  it('dirty marker carries data-dirty="true"', () => {
    const { getAllByTestId } = renderMap({ dirtyIds: new Set(['a']) });
    const markers = getAllByTestId('marker');
    const alpha = markers.find((m) => m.getAttribute('data-title') === 'Alpha');
    const bravo = markers.find((m) => m.getAttribute('data-title') === 'Bravo');
    expect(alpha).toHaveAttribute('data-dirty', 'true');
    expect(bravo).toHaveAttribute('data-dirty', 'false');
  });

  it('marker dragend fires onPositionChange(id, lat, lng)', () => {
    const onPositionChange = vi.fn();
    renderMap({ onPositionChange });
    // Synthesize a drag on Alpha via the captured handler.
    g.__markerDragHandlers!.Alpha!({ lat: 53.55, lng: 9.55 });
    expect(onPositionChange).toHaveBeenCalledWith('a', 53.55, 9.55);
  });

  it('focusTentId change triggers map.flyTo on the focused tent', () => {
    const { rerender } = renderMap();
    // Initially focusTentId=null → no flyTo.
    expect(g.__mockMap!.flyTo).not.toHaveBeenCalled();
    rerender(
      <PositionsMap
        tents={SAMPLE}
        dirtyIds={new Set()}
        focusTentId="b"
        canEdit={true}
        tileStyle="osm"
        onTileStyleChange={vi.fn()}
        onPositionChange={vi.fn()}
        defaultCenter={[53, 9]}
        defaultZoom={18}
      />,
    );
    expect(g.__mockMap!.flyTo).toHaveBeenCalledTimes(1);
    const [latlng] = g.__mockMap!.flyTo.mock.calls[0]!;
    expect(latlng).toEqual({ lat: 53.2, lng: 9.2 });
  });
});
