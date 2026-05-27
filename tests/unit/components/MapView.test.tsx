import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { MapView } from '../../../src/components/MapView';
import type { TentWithCategories } from '../../../src/lib/supabase';

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
    };
    g.__currentMockZoom = undefined;
    g.__mapZoomEndHandler = undefined;
  });

  it('renders one marker per tent with valid coordinates', () => {
    const { getAllByTestId } = render(
      <MapView
        tents={SAMPLE_TENTS}
        center={[49.0, 8.4]}
        zoom={17}
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
        onMarkerClick={() => {}}
      />,
    );
    const markers = getAllByTestId('marker');
    expect(markers[0]!.getAttribute('data-title')).toBe('Stand 1');
    expect(markers[1]!.getAttribute('data-title')).toBe('Stand 2');
  });
});
