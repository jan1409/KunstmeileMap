import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Props {
  lat: number | null;
  lng: number | null;
  defaultCenter: [number, number];
  defaultZoom: number;
  onChange: (next: { lat: number | null; lng: number | null }) => void;
}

function MapClickHandler({
  onClick,
}: {
  onClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click: (e: { latlng: { lat: number; lng: number } }) => {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function TentMapEditor({
  lat,
  lng,
  defaultCenter,
  defaultZoom,
  onChange,
}: Props) {
  const { t } = useTranslation();
  const hasCoord = lat != null && lng != null;
  const markerPos: [number, number] = hasCoord ? [lat, lng] : defaultCenter;

  // Tailwind-styled pin so we don't depend on Leaflet's default marker PNG
  // (which Vite doesn't resolve out of the box — would render as a broken image).
  const pinIcon = useMemo(
    () =>
      L.divIcon({
        html:
          '<div style="height:24px;width:24px;border-radius:9999px;background:#ef4444;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>',
        className: '',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
    [],
  );

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <label className="flex-1 text-xs">
          <span className="block text-white/60">Lat</span>
          <input
            type="number"
            step="any"
            value={lat ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? null : Number(e.target.value);
              onChange({ lat: v, lng });
            }}
            className="input mt-1"
            aria-label="Lat"
          />
        </label>
        <label className="flex-1 text-xs">
          <span className="block text-white/60">Lng</span>
          <input
            type="number"
            step="any"
            value={lng ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? null : Number(e.target.value);
              onChange({ lat, lng: v });
            }}
            className="input mt-1"
            aria-label="Lng"
          />
        </label>
      </div>

      <div className="h-64 w-full overflow-hidden rounded border border-white/10">
        <MapContainer
          center={hasCoord ? markerPos : defaultCenter}
          zoom={defaultZoom}
          maxZoom={22}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxNativeZoom={19}
            maxZoom={22}
          />
          <MapClickHandler onClick={(lt, ln) => onChange({ lat: lt, lng: ln })} />
          {hasCoord && (
            <Marker
              position={markerPos}
              icon={pinIcon}
              draggable
              eventHandlers={{
                dragend: (e: {
                  target: { getLatLng: () => { lat: number; lng: number } };
                }) => {
                  const p = e.target.getLatLng();
                  onChange({ lat: p.lat, lng: p.lng });
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      <button
        type="button"
        onClick={() => onChange({ lat: null, lng: null })}
        disabled={!hasCoord}
        className="rounded bg-white/10 px-3 py-1 text-xs disabled:opacity-50"
      >
        {t('admin.tent.clear_coords')}
      </button>
    </div>
  );
}
