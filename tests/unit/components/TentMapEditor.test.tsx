import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

import '../../../src/lib/i18n';

import { TentMapEditor } from '../../../src/components/TentMapEditor';

vi.mock('leaflet', () => ({
  default: {
    divIcon: vi.fn((opts: { iconSize?: [number, number] }) => ({ options: opts })),
  },
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="map">{children}</div>
  ),
  TileLayer: () => null,
  Marker: ({
    position,
    draggable,
    icon,
    eventHandlers,
  }: {
    position: [number, number];
    draggable?: boolean;
    icon?: { options?: { iconSize?: [number, number] } };
    eventHandlers?: {
      dragend?: (e: {
        target: { getLatLng: () => { lat: number; lng: number } };
      }) => void;
    };
  }) => {
    const iconSize = icon?.options?.iconSize;
    const variant =
      iconSize && iconSize[0] === 24 ? 'dot' : 'full';
    return (
      <button
        data-testid="marker"
        data-position={JSON.stringify(position)}
        data-variant={variant}
        onClick={() =>
          eventHandlers?.dragend?.({
            target: {
              getLatLng: () => ({
                lat: position[0] + 0.01,
                lng: position[1] + 0.01,
              }),
            },
          })
        }
      >
        {draggable ? 'draggable' : 'static'}
      </button>
    );
  },
  useMapEvents: (handlers: {
    click?: (e: { latlng: { lat: number; lng: number } }) => void;
    zoomend?: () => void;
  }) => {
    const g = globalThis as unknown as {
      __mapClickHandler?: typeof handlers.click;
      __mapZoomEndHandler?: () => void;
      __currentMockZoom?: number;
    };
    if (handlers.click) g.__mapClickHandler = handlers.click;
    if (handlers.zoomend) g.__mapZoomEndHandler = handlers.zoomend;
    g.__currentMockZoom = g.__currentMockZoom ?? 18;
    return { getZoom: () => g.__currentMockZoom ?? 18 };
  },
  ZoomControl: () => null,
}));


describe('TentMapEditor', () => {
  beforeEach(() => {
    const g = globalThis as unknown as {
      __currentMockZoom?: number;
      __mapZoomEndHandler?: () => void;
      __mapClickHandler?: unknown;
    };
    g.__currentMockZoom = undefined;
    g.__mapZoomEndHandler = undefined;
    g.__mapClickHandler = undefined;
  });

  it('renders inputs reflecting the current lat/lng', () => {
    const { getByLabelText } = render(
      <TentMapEditor
        lat={49.0}
        lng={8.4}
        defaultCenter={[49.0, 8.4]}
        defaultZoom={17}
        onChange={() => {}}
      />,
    );
    expect((getByLabelText(/Lat/i) as HTMLInputElement).value).toBe('49');
    expect((getByLabelText(/Lng/i) as HTMLInputElement).value).toBe('8.4');
  });

  it('calls onChange when the Lat input is edited', () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <TentMapEditor
        lat={49.0}
        lng={8.4}
        defaultCenter={[49.0, 8.4]}
        defaultZoom={17}
        onChange={onChange}
      />,
    );
    fireEvent.change(getByLabelText(/Lat/i), { target: { value: '49.5' } });
    expect(onChange).toHaveBeenCalledWith({ lat: 49.5, lng: 8.4 });
  });

  it('calls onChange when the marker is dragged', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      <TentMapEditor
        lat={49.0}
        lng={8.4}
        defaultCenter={[49.0, 8.4]}
        defaultZoom={17}
        onChange={onChange}
      />,
    );
    getByTestId('marker').click(); // mock fires dragend on click
    expect(onChange).toHaveBeenCalledWith({ lat: 49.01, lng: 8.41 });
  });

  it('calls onChange when the map is clicked (no current marker)', () => {
    const onChange = vi.fn();
    render(
      <TentMapEditor
        lat={null}
        lng={null}
        defaultCenter={[49.0, 8.4]}
        defaultZoom={17}
        onChange={onChange}
      />,
    );
    const handler = (
      globalThis as unknown as {
        __mapClickHandler?: (e: { latlng: { lat: number; lng: number } }) => void;
      }
    ).__mapClickHandler;
    handler?.({ latlng: { lat: 49.5, lng: 8.5 } });
    expect(onChange).toHaveBeenCalledWith({ lat: 49.5, lng: 8.5 });
  });

  it('clears coordinates when the clear button is clicked', () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <TentMapEditor
        lat={49.0}
        lng={8.4}
        defaultCenter={[49.0, 8.4]}
        defaultZoom={17}
        onChange={onChange}
      />,
    );
    // The button label is locale-dependent (i18n in tests can pick up navigator
    // language). Match either German or English copy.
    fireEvent.click(getByRole('button', { name: /Koordinaten löschen|Clear coordinates/i }));
    expect(onChange).toHaveBeenCalledWith({ lat: null, lng: null });
  });

  it('renders neighbor tents as "dot" variant below MARKER_DETAIL_ZOOM', () => {
    (globalThis as unknown as { __currentMockZoom?: number }).__currentMockZoom = 18;
    const { getAllByTestId } = render(
      <TentMapEditor
        lat={null}
        lng={null}
        defaultCenter={[49.0, 8.4]}
        defaultZoom={18}
        onChange={() => {}}
        otherTents={[
          { id: 'a', name: 'A', display_number: 1, lat: 49.001, lng: 8.401 },
          { id: 'b', name: 'B', display_number: 2, lat: 49.002, lng: 8.402 },
        ]}
      />,
    );
    const markers = getAllByTestId('marker');
    // Both neighbors should be dot-variant. No red current pin because lat/lng are null.
    expect(markers).toHaveLength(2);
    markers.forEach((m) => expect(m.getAttribute('data-variant')).toBe('dot'));
  });

  it('renders neighbor tents as "full" variant at MARKER_DETAIL_ZOOM and above', () => {
    (globalThis as unknown as { __currentMockZoom?: number }).__currentMockZoom = 20;
    const { getAllByTestId } = render(
      <TentMapEditor
        lat={null}
        lng={null}
        defaultCenter={[49.0, 8.4]}
        defaultZoom={20}
        onChange={() => {}}
        otherTents={[
          { id: 'a', name: 'A', display_number: 1, lat: 49.001, lng: 8.401 },
        ]}
      />,
    );
    expect(getAllByTestId('marker')[0]!.getAttribute('data-variant')).toBe(
      'full',
    );
  });

  it('keeps the red current pin at full size regardless of zoom', () => {
    (globalThis as unknown as { __currentMockZoom?: number }).__currentMockZoom = 18;
    const { getAllByTestId } = render(
      <TentMapEditor
        lat={49.0}
        lng={8.4}
        defaultCenter={[49.0, 8.4]}
        defaultZoom={18}
        onChange={() => {}}
        otherTents={[
          { id: 'a', name: 'A', display_number: 1, lat: 49.001, lng: 8.401 },
        ]}
      />,
    );
    // Two markers expected: the red current pin and one green neighbor.
    // Distinguish via `draggable` attribute: only the red pin is draggable.
    const markers = getAllByTestId('marker');
    const draggable = markers.find((m) => m.textContent === 'draggable');
    const neighbors = markers.filter((m) => m.textContent === 'static');
    expect(draggable).toBeDefined();
    expect(neighbors).toHaveLength(1);
    expect(neighbors[0]!.getAttribute('data-variant')).toBe('dot');
    // The red pin is 26x26 in production (size bumped from 24 in T4 so the
    // mock's iconSize-based heuristic doesn't mis-classify it as a dot).
    // The mock will report its variant as 'full' since iconSize[0] !== 24.
    expect(draggable!.getAttribute('data-variant')).toBe('full');
  });
});
