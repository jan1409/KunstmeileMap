/**
 * Pure helpers used by the public Leaflet map. Kept side-effect-free so they
 * can be unit-tested in jsdom without bringing in `leaflet` or
 * `react-leaflet`.
 */

import L from 'leaflet';

export function isValidCoord(lat: number, lng: number): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function clampZoom(z: number): number {
  const rounded = Math.round(z);
  return Math.min(19, Math.max(1, rounded));
}

export interface Bounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export function computeBounds(
  coords: Array<{ lat: number; lng: number }>,
): Bounds | null {
  if (coords.length === 0) return null;
  // noUncheckedIndexedAccess: narrow coords[0] safely.
  const first = coords[0]!;
  let south = first.lat;
  let north = first.lat;
  let west = first.lng;
  let east = first.lng;
  for (const c of coords) {
    if (c.lat < south) south = c.lat;
    if (c.lat > north) north = c.lat;
    if (c.lng < west) west = c.lng;
    if (c.lng > east) east = c.lng;
  }
  return { south, west, north, east };
}

const CATEGORY_PALETTE = [
  '#e57373',
  '#64b5f6',
  '#81c784',
  '#ffd54f',
  '#ba68c8',
  '#4dd0e1',
  '#ff8a65',
  '#a1887f',
];

export function colorForSlug(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return CATEGORY_PALETTE[h % CATEGORY_PALETTE.length]!;
}

export function markerColorForCategories(
  cats: Array<{ slug: string }>,
): string {
  if (cats.length === 0) return '#888';
  return colorForSlug(cats[0]!.slug);
}

/**
 * Zoom threshold at which markers switch from compact dots (below) to full
 * numbered badges (at/above). Calibrated for the Kunstmeile site at Lat 53°:
 * 28px markers are ~2.5m wide at z=20, fitting the 3–4m stand spacing.
 * See docs/superpowers/specs/2026-05-27-zoom-based-markers-design.md.
 */
export const MARKER_DETAIL_ZOOM = 20;

/**
 * Zoom level used when the user selects a tent. At this zoom the full numbered
 * badge is visible (>= MARKER_DETAIL_ZOOM), making the chosen tent unambiguous.
 */
export const TENT_FOCUS_ZOOM = 20;

export type TileStyle = 'osm' | 'satellite';

interface TileConfig {
  url: string;
  attribution: string;
  /**
   * Max zoom the provider serves natively. Below this map zoom stays
   * interactive but tiles may stop loading above. Both providers in this app
   * stop serving fresh tiles above z=19 — Leaflet keeps the last tiles
   * up-scaled when the user zooms further (maxZoom on MapContainer = 22).
   */
  maxNativeZoom: number;
}

/**
 * Two interchangeable tile providers. The OSM entry mirrors the verbatim
 * URL + attribution that lived inline in MapView/TentMapEditor before the
 * satellite toggle was introduced — keep them in sync if you change either.
 *
 * Esri World Imagery is free and requires no API key. Their TOS asks for
 * the multi-source attribution string below; do not shorten it.
 */
export const TILE_CONFIGS: Record<TileStyle, TileConfig> = {
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxNativeZoom: 19,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxNativeZoom: 19,
  },
};

/**
 * Compute the map center that places `tentLatLng` at the upper-third of the
 * map container (horizontally centered, vertically at 1/3 from the top) when
 * the map is rendered at `targetZoom`.
 *
 * Pure-ish helper — exported for unit testing. Pass `map` (the Leaflet map
 * instance) so the projection + container size are read consistently.
 *
 * The map's flyTo() target latlng becomes the rendered (W/2, H/2) center.
 * We want the tent rendered at (W/2, H/3), so the new center must sit
 * H/2 - H/3 = H/6 pixels SOUTH of the tent (Leaflet screen-y grows
 * downward, so adding to y in pixel space shifts the resulting latlng south).
 */
export function focusedCenter(
  map: L.Map,
  tentLatLng: L.LatLng,
  targetZoom: number,
): L.LatLng {
  const size = map.getSize();
  const offsetY = size.y / 6;
  const tentPoint = map.project(tentLatLng, targetZoom);
  const shiftedPoint = L.point(tentPoint.x, tentPoint.y + offsetY);
  return map.unproject(shiftedPoint, targetZoom);
}
