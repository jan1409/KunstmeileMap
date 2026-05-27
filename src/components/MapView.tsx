import { useState } from 'react';
import { MapContainer, Marker, TileLayer, ZoomControl, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { renderToString } from 'react-dom/server';
import 'leaflet/dist/leaflet.css';
import type { TentWithCategories } from '../lib/supabase';
import { isValidCoord, markerColorForCategories, MARKER_DETAIL_ZOOM } from '../lib/map';
import { TentMarker } from './TentMarker';

interface Props {
  tents: TentWithCategories[];
  center: [number, number];
  zoom: number;
  onMarkerClick: (tent: TentWithCategories) => void;
}

/**
 * Internal helper: subscribes to Leaflet's `zoomend` event and reports the
 * current zoom level back to the parent so it can swap marker variants on
 * the MARKER_DETAIL_ZOOM threshold. Renders no DOM of its own.
 */
function ZoomTracker({ onZoomChange }: { onZoomChange: (z: number) => void }) {
  const map = useMapEvents({
    zoomend: () => onZoomChange(map.getZoom()),
  });
  return null;
}

/**
 * Public Leaflet map. Renders one marker per tent with valid coordinates,
 * skipping tents whose lat/lng are null or out of range. Marker color is
 * derived from the tent's first category slug. Below MARKER_DETAIL_ZOOM the
 * marker is a compact dot; at/above it is the full numbered badge.
 * Clicking either invokes `onMarkerClick(tent)` — the parent owns
 * selection / URL state.
 */
export function MapView({ tents, center, zoom, onMarkerClick }: Props) {
  const [currentZoom, setCurrentZoom] = useState<number>(zoom);
  const variant: 'dot' | 'full' =
    currentZoom >= MARKER_DETAIL_ZOOM ? 'full' : 'dot';

  const placed = tents.filter(
    (t): t is TentWithCategories & { lat: number; lng: number } =>
      t.lat != null && t.lng != null && isValidCoord(t.lat, t.lng),
  );

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      maxZoom={22}
      zoomControl={false}
      className="h-full w-full"
    >
      <ZoomTracker onZoomChange={setCurrentZoom} />
      <ZoomControl position="bottomleft" />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxNativeZoom={19}
        maxZoom={22}
      />
      {placed.map((t) => {
        const color = markerColorForCategories(t.categories ?? []);
        const icon = L.divIcon({
          html: renderToString(
            <TentMarker
              displayNumber={t.display_number}
              color={color}
              ariaLabel={t.name}
              variant={variant}
            />,
          ),
          className: '',
          iconSize: variant === 'dot' ? [24, 24] : [28, 28],
          iconAnchor: variant === 'dot' ? [12, 12] : [14, 14],
        });
        return (
          <Marker
            key={t.id}
            position={[t.lat, t.lng]}
            icon={icon}
            title={t.name}
            eventHandlers={{ click: () => onMarkerClick(t) }}
          />
        );
      })}
    </MapContainer>
  );
}
