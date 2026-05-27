import { MapContainer, Marker, TileLayer, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { renderToString } from 'react-dom/server';
import 'leaflet/dist/leaflet.css';
import type { TentWithCategories } from '../lib/supabase';
import { isValidCoord, markerColorForCategories } from '../lib/map';
import { TentMarker } from './TentMarker';

interface Props {
  tents: TentWithCategories[];
  center: [number, number];
  zoom: number;
  onMarkerClick: (tent: TentWithCategories) => void;
}

/**
 * Public Leaflet map. Renders one marker per tent with valid coordinates,
 * skipping tents whose lat/lng are null or out of range. Marker color is
 * derived from the tent's first category slug. Clicking a marker invokes
 * `onMarkerClick(tent)` — the parent owns selection / URL state.
 */
export function MapView({ tents, center, zoom, onMarkerClick }: Props) {
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
            />,
          ),
          className: '',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        return (
          <Marker
            key={t.id}
            position={[t.lat, t.lng]}
            icon={icon}
            eventHandlers={{ click: () => onMarkerClick(t) }}
          />
        );
      })}
    </MapContainer>
  );
}
