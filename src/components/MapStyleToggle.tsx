import { useTranslation } from 'react-i18next';
import type { TileStyle } from '../lib/map';

interface Props {
  value: TileStyle;
  onChange: (next: TileStyle) => void;
}

/**
 * Two-state pill that switches the active map tile provider.
 *
 * Rendered as a child of `<MapContainer>` so Leaflet's positioning helpers
 * (`leaflet-top leaflet-right`, `leaflet-control`) place it correctly and
 * give it the right z-index relative to the map. The outer wrapper is
 * `pointer-events-none` so the rest of the corner area stays draggable; the
 * inner control re-enables `pointer-events-auto` only on the actual pill.
 */
export function MapStyleToggle({ value, onChange }: Props) {
  const { t } = useTranslation();
  const baseClass = 'px-3 py-1 text-xs font-medium transition-colors';
  const activeClass = 'bg-white/90 text-neutral-900';
  const inactiveClass = 'bg-neutral-900/70 text-white/80 hover:bg-neutral-900/85';

  return (
    <div
      role="group"
      aria-label={t('map_style.toggle_aria')}
      className="leaflet-top leaflet-right pointer-events-none"
    >
      <div className="leaflet-control pointer-events-auto m-3 overflow-hidden rounded-full shadow-lg ring-1 ring-black/10">
        <button
          type="button"
          onClick={() => onChange('osm')}
          aria-pressed={value === 'osm'}
          className={`${baseClass} ${value === 'osm' ? activeClass : inactiveClass}`}
        >
          {t('map_style.osm')}
        </button>
        <button
          type="button"
          onClick={() => onChange('satellite')}
          aria-pressed={value === 'satellite'}
          className={`${baseClass} ${value === 'satellite' ? activeClass : inactiveClass}`}
        >
          {t('map_style.satellite')}
        </button>
      </div>
    </div>
  );
}
