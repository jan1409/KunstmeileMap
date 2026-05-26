import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

import '../../../src/lib/i18n';

import { TentMapEditor } from '../../../src/components/TentMapEditor';

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="map">{children}</div>
  ),
  TileLayer: () => null,
  Marker: ({
    position,
    draggable,
    eventHandlers,
  }: {
    position: [number, number];
    draggable?: boolean;
    eventHandlers?: {
      dragend?: (e: {
        target: { getLatLng: () => { lat: number; lng: number } };
      }) => void;
    };
  }) => (
    <button
      data-testid="marker"
      data-position={JSON.stringify(position)}
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
  ),
  useMapEvents: (handlers: { click?: (e: { latlng: { lat: number; lng: number } }) => void }) => {
    (globalThis as unknown as { __mapClickHandler?: typeof handlers.click }).__mapClickHandler =
      handlers.click;
    return null;
  },
}));

vi.mock('leaflet', () => ({ default: {} }));

describe('TentMapEditor', () => {
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
});
