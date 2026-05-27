import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
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
    eventHandlers,
  }: {
    position: [number, number];
    eventHandlers?: { click?: () => void };
  }) => (
    <div
      data-testid="marker"
      data-position={JSON.stringify(position)}
      onClick={() => eventHandlers?.click?.()}
    />
  ),
  ZoomControl: () => <div data-testid="zoom-control" />,
}));

vi.mock('leaflet', () => ({
  default: {
    divIcon: () => ({}),
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
});
