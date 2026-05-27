/**
 * Pure helpers used by the public Leaflet map. Kept side-effect-free so they
 * can be unit-tested in jsdom without bringing in `leaflet` or
 * `react-leaflet`.
 */

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
