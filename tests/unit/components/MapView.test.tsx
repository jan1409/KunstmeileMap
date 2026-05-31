import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { MapView, TentFocusController } from '../../../src/components/MapView';
import type { TentWithCategories } from '../../../src/lib/supabase';

// Shared stub Leaflet "map" used by the useMap() mock + TentFocusController tests.
interface MockMap {
  flyTo: ReturnType<typeof vi.fn>;
  getCenter: ReturnType<typeof vi.fn>;
  getZoom: ReturnType<typeof vi.fn>;
  getSize: ReturnType<typeof vi.fn>;
  project: ReturnType<typeof vi.fn>;
  unproject: ReturnType<typeof vi.fn>;
}

function makeMockMap(initial: {
  center?: { lat: number; lng: number };
  zoom?: number;
} = {}): MockMap {
  return {
    flyTo: vi.fn(),
    getCenter: vi.fn(() => initial.center ?? { lat: 0, lng: 0 }),
    getZoom: vi.fn(() => initial.zoom ?? 18),
    getSize: vi.fn(() => ({ x: 600, y: 900 })),
    project: vi.fn((latlng: { lat: number; lng: number }) => ({
      x: latlng.lng * 100,
      y: latlng.lat * 100,
    })),
    unproject: vi.fn((pt: { x: number; y: number }) => ({
      lat: pt.y / 100,
      lng: pt.x / 100,
    })),
  };
}

// Mock react-leaflet: each primitive becomes a plain div with data-testid.
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
    <div
      data-testid="map"
      data-center={JSON.stringify(center)}
      data-zoom={zoom}
    >
      {children}
    </div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({
    position,
    icon,
    title,
    eventHandlers,
  }: {
    position: [number, number];
    icon?: { options?: { iconSize?: [number, number] } };
    title?: string;
    eventHandlers?: { click?: () => void };
  }) => {
    // Surface the variant via the icon's iconSize so tests can assert on it
    // without coupling to renderToString HTML internals.
    const iconSize = icon?.options?.iconSize;
    const variant =
      iconSize && iconSize[0] === 24 ? 'dot' : 'full';
    return (
      <div
        data-testid="marker"
        data-position={JSON.stringify(position)}
        data-variant={variant}
        data-title={title ?? ''}
        onClick={() => eventHandlers?.click?.()}
      />
    );
  },
  ZoomControl: () => <div data-testid="zoom-control" />,
  useMap: () => {
    const g = globalThis as unknown as { __mockMap?: MockMap };
    if (!g.__mockMap) g.__mockMap = makeMockMap();
    return g.__mockMap;
  },
  useMapEvents: (handlers: { zoomend?: () => void }) => {
    (globalThis as unknown as { __mapZoomEndHandler?: () => void }).__mapZoomEndHandler =
      handlers.zoomend;
    const g = globalThis as unknown as {
      __currentMockZoom?: number;
      __mapSetZoom?: (z: number) => void;
    };
    g.__currentMockZoom = g.__currentMockZoom ?? 18;
    g.__mapSetZoom = (z: number) => {
      g.__currentMockZoom = z;
    };
    return { getZoom: () => g.__currentMockZoom ?? 18 };
  },
}));

vi.mock('leaflet', () => ({
  default: {
    divIcon: (opts: { iconSize?: [number, number] }) => ({ options: opts }),
    latLng: (lat: number, lng: number) => ({ lat, lng }),
    point: (x: number, y: number) => ({ x, y }),
  },
}));

// Avoid importing the real leaflet CSS during tests.
vi.mock('leaflet/dist/leaflet.css', () => ({}));

const SAMPLE_TENTS = [
  {
    id: 't1',
    slug: 's1',
    name: 'Stand 1',
    display_number: 1,
    lat: 49.0,
    lng: 8.4,
    categories: [],
  },
  {
    id: 't2',
    slug: 's2',
    name: 'Stand 2',
    display_number: 2,
    lat: 49.1,
    lng: 8.5,
    categories: [],
  },
  {
    id: 't3',
    slug: 's3',
    name: 'No coords',
    display_number: 3,
    lat: null,
    lng: null,
    categories: [],
  },
] as unknown as TentWithCategories[];

describe('MapView', () => {
  beforeEach(() => {
    const g = globalThis as unknown as {
      __currentMockZoom?: number;
      __mapZoomEndHandler?: () => void;
      __mockMap?: MockMap;
    };
    g.__currentMockZoom = undefined;
    g.__mapZoomEndHandler = undefined;
    g.__mockMap = undefined;
  });

  it('renders one marker per tent with valid coordinates', () => {
    const { getAllByTestId } = render(
      <MapView
        tents={SAMPLE_TENTS}
        center={[49.0, 8.4]}
        zoom={17}
        focusTent={null}
        onMarkerClick={() => {}}
      />,
    );
    expect(getAllByTestId('marker')).toHaveLength(2);
  });

  it('uses the supplied center and zoom on the MapContainer', () => {
    const { getByTestId } = render(
      <MapView
        tents={[]}
        center={[49.5, 8.5]}
        zoom={18}
        focusTent={null}
        onMarkerClick={() => {}}
      />,
    );
    const map = getByTestId('map');
    expect(map.getAttribute('data-center')).toBe('[49.5,8.5]');
    expect(map.getAttribute('data-zoom')).toBe('18');
  });

  it('calls onMarkerClick with the tent when a marker is clicked', () => {
    const onClick = vi.fn();
    const { getAllByTestId } = render(
      <MapView
        tents={SAMPLE_TENTS}
        center={[49.0, 8.4]}
        zoom={17}
        focusTent={null}
        onMarkerClick={onClick}
      />,
    );
    getAllByTestId('marker')[0]!.click();
    expect(onClick).toHaveBeenCalledWith(SAMPLE_TENTS[0]);
  });

  it('renders markers as "dot" variant when initial zoom is below MARKER_DETAIL_ZOOM', () => {
    (globalThis as unknown as { __currentMockZoom?: number }).__currentMockZoom = 18;
    const { getAllByTestId } = render(
      <MapView
        tents={SAMPLE_TENTS}
        center={[49.0, 8.4]}
        zoom={18}
        focusTent={null}
        onMarkerClick={() => {}}
      />,
    );
    const markers = getAllByTestId('marker');
    expect(markers).toHaveLength(2);
    markers.forEach((m) => expect(m.getAttribute('data-variant')).toBe('dot'));
  });

  it('renders markers as "full" variant when initial zoom is at MARKER_DETAIL_ZOOM', () => {
    (globalThis as unknown as { __currentMockZoom?: number }).__currentMockZoom = 20;
    const { getAllByTestId } = render(
      <MapView
        tents={SAMPLE_TENTS}
        center={[49.0, 8.4]}
        zoom={20}
        focusTent={null}
        onMarkerClick={() => {}}
      />,
    );
    getAllByTestId('marker').forEach((m) =>
      expect(m.getAttribute('data-variant')).toBe('full'),
    );
  });

  it('swaps marker variant when the map zoom changes (zoomend event)', async () => {
    (globalThis as unknown as { __currentMockZoom?: number }).__currentMockZoom = 18;
    const { getAllByTestId } = render(
      <MapView
        tents={SAMPLE_TENTS}
        center={[49.0, 8.4]}
        zoom={18}
        focusTent={null}
        onMarkerClick={() => {}}
      />,
    );
    expect(getAllByTestId('marker')[0]!.getAttribute('data-variant')).toBe('dot');

    await act(async () => {
      (globalThis as unknown as { __mapSetZoom?: (z: number) => void }).__mapSetZoom?.(20);
      (globalThis as unknown as { __mapZoomEndHandler?: () => void }).__mapZoomEndHandler?.();
    });

    expect(getAllByTestId('marker')[0]!.getAttribute('data-variant')).toBe('full');
  });

  it('passes the tent name as the Marker title (browser tooltip)', () => {
    (globalThis as unknown as { __currentMockZoom?: number }).__currentMockZoom = 18;
    const { getAllByTestId } = render(
      <MapView
        tents={SAMPLE_TENTS}
        center={[49.0, 8.4]}
        zoom={18}
        focusTent={null}
        onMarkerClick={() => {}}
      />,
    );
    const markers = getAllByTestId('marker');
    expect(markers[0]!.getAttribute('data-title')).toBe('Stand 1');
    expect(markers[1]!.getAttribute('data-title')).toBe('Stand 2');
  });
});

describe('TentFocusController', () => {
  beforeEach(() => {
    const g = globalThis as unknown as { __mockMap?: MockMap };
    g.__mockMap = undefined;
  });

  it('snapshots the current view and flies to the focused-center on null -> tent', () => {
    const mockMap = makeMockMap({ center: { lat: 1, lng: 2 }, zoom: 17 });
    (globalThis as unknown as { __mockMap?: MockMap }).__mockMap = mockMap;

    const tent = SAMPLE_TENTS[0]!; // lat 49.0, lng 8.4

    const { rerender } = render(
      <TentFocusController
        focusTent={null}
        defaultCenter={[49.5, 8.5]}
        defaultZoom={18}
      />,
    );
    // Initial render with null focus should not call flyTo.
    expect(mockMap.flyTo).not.toHaveBeenCalled();

    rerender(
      <TentFocusController
        focusTent={tent}
        defaultCenter={[49.5, 8.5]}
        defaultZoom={18}
      />,
    );

    expect(mockMap.getCenter).toHaveBeenCalled();
    expect(mockMap.getZoom).toHaveBeenCalled();
    expect(mockMap.flyTo).toHaveBeenCalledTimes(1);
    const [targetCenter, targetZoom] = mockMap.flyTo.mock.calls[0]!;
    // TENT_FOCUS_ZOOM is 20.
    expect(targetZoom).toBe(20);
    // With our 1:1 mock projection (x = lng*100, y = lat*100, getSize y = 900),
    // tent (49.0, 8.4) -> project (840, 4900) -> shifted (840, 5050) -> unproject (50.5, 8.4).
    expect(targetCenter.lat).toBeCloseTo(50.5);
    expect(targetCenter.lng).toBeCloseTo(8.4);
  });

  it('restores the snapshotted view on tent -> null', () => {
    const mockMap = makeMockMap({ center: { lat: 1.25, lng: 2.5 }, zoom: 17 });
    (globalThis as unknown as { __mockMap?: MockMap }).__mockMap = mockMap;

    const tent = SAMPLE_TENTS[0]!;

    const { rerender } = render(
      <TentFocusController
        focusTent={null}
        defaultCenter={[49.5, 8.5]}
        defaultZoom={18}
      />,
    );
    rerender(
      <TentFocusController
        focusTent={tent}
        defaultCenter={[49.5, 8.5]}
        defaultZoom={18}
      />,
    );
    expect(mockMap.flyTo).toHaveBeenCalledTimes(1);

    rerender(
      <TentFocusController
        focusTent={null}
        defaultCenter={[49.5, 8.5]}
        defaultZoom={18}
      />,
    );

    expect(mockMap.flyTo).toHaveBeenCalledTimes(2);
    const [restoreCenter, restoreZoom] = mockMap.flyTo.mock.calls[1]!;
    expect(restoreCenter).toEqual({ lat: 1.25, lng: 2.5 });
    expect(restoreZoom).toBe(17);
  });

  it('flies to the tent on mount-with-tent (deep-link entry) snapshotting the initial map view', () => {
    // Simulates the URL-deep-link case: the page loads with /event/tent/:slug,
    // so focusTent is non-null on first render. The mount-effect should
    // snapshot the map's initial view (= the event default) and fly to the
    // tent. Closing then restores to that initial view.
    const mockMap = makeMockMap({ center: { lat: 53.27, lng: 9.51 }, zoom: 18 });
    (globalThis as unknown as { __mockMap?: MockMap }).__mockMap = mockMap;

    const tent = SAMPLE_TENTS[0]!;

    const { rerender } = render(
      <TentFocusController
        focusTent={tent}
        defaultCenter={[53.27, 9.51]}
        defaultZoom={18}
      />,
    );
    expect(mockMap.flyTo).toHaveBeenCalledTimes(1);

    rerender(
      <TentFocusController
        focusTent={null}
        defaultCenter={[53.27, 9.51]}
        defaultZoom={18}
      />,
    );

    expect(mockMap.flyTo).toHaveBeenCalledTimes(2);
    const [restoreCenter, restoreZoom] = mockMap.flyTo.mock.calls[1]!;
    expect(restoreCenter).toEqual({ lat: 53.27, lng: 9.51 });
    expect(restoreZoom).toBe(18);
  });

  it('does not fly when transitioning null -> tent without valid coords', () => {
    const mockMap = makeMockMap();
    (globalThis as unknown as { __mockMap?: MockMap }).__mockMap = mockMap;

    const tentNoCoords = SAMPLE_TENTS[2]!; // lat/lng null

    const { rerender } = render(
      <TentFocusController
        focusTent={null}
        defaultCenter={[49.5, 8.5]}
        defaultZoom={18}
      />,
    );
    rerender(
      <TentFocusController
        focusTent={tentNoCoords}
        defaultCenter={[49.5, 8.5]}
        defaultZoom={18}
      />,
    );

    expect(mockMap.flyTo).not.toHaveBeenCalled();
  });
});
