import { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TENT_FOCUS_ZOOM, TILE_CONFIGS, type TileStyle } from '../lib/map';
import { MapStyleToggle } from './MapStyleToggle';

export interface PositionsMapTent {
  id: string;
  name: string;
  display_number: number | null;
  lat: number;
  lng: number;
}

interface Props {
  tents: PositionsMapTent[];
  dirtyIds: Set<string>;
  focusTentId: string | null;
  canEdit: boolean;
  tileStyle: TileStyle;
  onTileStyleChange: (next: TileStyle) => void;
  onPositionChange: (id: string, lat: number, lng: number) => void;
  defaultCenter: [number, number];
  defaultZoom: number;
}

function FocusController({
  tents,
  focusTentId,
}: {
  tents: PositionsMapTent[];
  focusTentId: string | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (!focusTentId) return;
    const tent = tents.find((t) => t.id === focusTentId);
    if (!tent) return;
    map.flyTo({ lat: tent.lat, lng: tent.lng }, TENT_FOCUS_ZOOM, {
      animate: true,
      duration: 0.6,
    });
  }, [focusTentId, tents, map]);
  return null;
}

function tentIcon(tent: PositionsMapTent, dirty: boolean): L.DivIcon {
  const label = tent.display_number != null ? String(tent.display_number) : '';
  const ring = dirty
    ? 'box-shadow:0 0 0 3px #facc15,0 1px 3px rgba(0,0,0,0.4);'
    : 'box-shadow:0 1px 3px rgba(0,0,0,0.4);';
  const bg = dirty ? '#facc15' : '#22c55e';
  const fg = dirty ? '#422006' : '#052e16';
  const cls = dirty ? 'marker-dirty' : 'marker-clean';
  return L.divIcon({
    html: `<div class="${cls}" style="height:24px;width:24px;border-radius:9999px;background:${bg};border:2px solid white;${ring}display:flex;align-items:center;justify-content:center;color:${fg};font-size:10px;font-weight:600;">${label}</div>`,
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

export function PositionsMap({
  tents,
  dirtyIds,
  focusTentId,
  canEdit,
  tileStyle,
  onTileStyleChange,
  onPositionChange,
  defaultCenter,
  defaultZoom,
}: Props) {
  return (
    <div className="h-full w-full overflow-hidden">
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        maxZoom={22}
        zoomControl={false}
        className="h-full w-full"
      >
        <ZoomControl position="bottomleft" />
        <MapStyleToggle value={tileStyle} onChange={onTileStyleChange} />
        <TileLayer
          key={tileStyle}
          attribution={TILE_CONFIGS[tileStyle].attribution}
          url={TILE_CONFIGS[tileStyle].url}
          maxNativeZoom={TILE_CONFIGS[tileStyle].maxNativeZoom}
          maxZoom={22}
        />
        <FocusController tents={tents} focusTentId={focusTentId} />
        {tents.map((tent) => {
          const dirty = dirtyIds.has(tent.id);
          return (
            <Marker
              key={tent.id}
              position={[tent.lat, tent.lng]}
              icon={tentIcon(tent, dirty)}
              draggable={canEdit}
              title={tent.name}
              eventHandlers={{
                dragend: (e: {
                  target: { getLatLng: () => { lat: number; lng: number } };
                }) => {
                  const p = e.target.getLatLng();
                  onPositionChange(tent.id, p.lat, p.lng);
                },
              }}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}
