import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapContainer, Marker, TileLayer, ZoomControl, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MARKER_DETAIL_ZOOM } from '../lib/map';

export interface OtherTent {
  id: string;
  name: string;
  display_number: number | null;
  lat: number;
  lng: number;
}

interface Props {
  lat: number | null;
  lng: number | null;
  defaultCenter: [number, number];
  defaultZoom: number;
  onChange: (next: { lat: number | null; lng: number | null }) => void;
  /** Other already-placed tents from the same event, shown in green for spatial context. */
  otherTents?: OtherTent[];
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

function ZoomTracker({ onZoomChange }: { onZoomChange: (z: number) => void }) {
  const map = useMapEvents({
    zoomend: () => onZoomChange(map.getZoom()),
  });
  return null;
}

export function TentMapEditor({
  lat,
  lng,
  defaultCenter,
  defaultZoom,
  onChange,
  otherTents = [],
}: Props) {
  const { t } = useTranslation();
  const hasCoord = lat != null && lng != null;
  const markerPos: [number, number] = hasCoord ? [lat, lng] : defaultCenter;

  const [currentZoom, setCurrentZoom] = useState<number>(defaultZoom);
  const neighborVariant: 'dot' | 'full' =
    currentZoom >= MARKER_DETAIL_ZOOM ? 'full' : 'dot';

  // Red pin (current tent). 26x26 so the test-mock's `iconSize[0] === 24`
  // dot-heuristic only matches the green neighbor-dots, not this one.
  const pinIcon = useMemo(
    () =>
      L.divIcon({
        html:
          '<div style="height:26px;width:26px;border-radius:9999px;background:#ef4444;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>',
        className: '',
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      }),
    [],
  );

  // Green neighbor markers — dot below threshold (24x24 hit area, 12x12
  // visual), full numbered badge at/above (20x20).
  function neighborIcon(displayNumber: number | null, variant: 'dot' | 'full') {
    if (variant === 'dot') {
      return L.divIcon({
        html:
          '<div style="display:flex;align-items:center;justify-content:center;height:24px;width:24px;"><div style="height:12px;width:12px;border-radius:9999px;background:#22c55e;border:2px solid white;box-shadow:0 1px 2px rgba(0,0,0,0.35);"></div></div>',
        className: '',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
    }
    const label = displayNumber != null ? String(displayNumber) : '';
    return L.divIcon({
      html: `<div style="height:20px;width:20px;border-radius:9999px;background:#22c55e;border:2px solid white;box-shadow:0 1px 2px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;color:#052e16;font-size:10px;font-weight:600;">${label}</div>`,
      className: '',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  }

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
          <MapClickHandler onClick={(lt, ln) => onChange({ lat: lt, lng: ln })} />
          {otherTents.map((o) => (
            <Marker
              key={o.id}
              position={[o.lat, o.lng]}
              icon={neighborIcon(o.display_number, neighborVariant)}
              interactive={false}
              keyboard={false}
              title={o.name}
            />
          ))}
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
