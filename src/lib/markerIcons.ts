/**
 * Curated registry of special map-marker symbols. A tent's `marker_icon`
 * column stores one of these `key`s; when set, the map renders the symbol
 * instead of the display number (see TentMarker). Keeping the picker, the map
 * marker, and the side panel driven by this single source of truth means a new
 * symbol is added in exactly one place.
 *
 * Icons come from lucide-react (already a dependency). They render to clean SVG
 * through `renderToString` in the Leaflet divIcon path with no runtime coupling.
 */
import {
  Utensils,
  Sandwich,
  IceCreamCone,
  Fish,
  CupSoda,
  HandPlatter,
  Beer,
  CakeSlice,
  Coffee,
  Pizza,
  SquareParking,
  type LucideIcon,
} from 'lucide-react';

export interface MarkerIconEntry {
  /** Stable key persisted in `tents.marker_icon`. Never rename in place. */
  key: string;
  labelDe: string;
  labelEn: string;
  Icon: LucideIcon;
}

export const MARKER_ICONS = [
  { key: 'utensils', labelDe: 'Essen', labelEn: 'Food', Icon: Utensils },
  { key: 'burger', labelDe: 'Burger', labelEn: 'Burger', Icon: Sandwich },
  { key: 'ice-cream', labelDe: 'Eis', labelEn: 'Ice cream', Icon: IceCreamCone },
  { key: 'fish', labelDe: 'Fisch', labelEn: 'Fish', Icon: Fish },
  { key: 'drink', labelDe: 'Getränke', labelEn: 'Drinks', Icon: CupSoda },
  {
    key: 'food-drink',
    labelDe: 'Essen & Getränke',
    labelEn: 'Food & drinks',
    Icon: HandPlatter,
  },
  { key: 'beer', labelDe: 'Bier', labelEn: 'Beer', Icon: Beer },
  { key: 'dessert', labelDe: 'Dessert', labelEn: 'Dessert', Icon: CakeSlice },
  { key: 'coffee', labelDe: 'Kaffee', labelEn: 'Coffee', Icon: Coffee },
  { key: 'pizza', labelDe: 'Pizza', labelEn: 'Pizza', Icon: Pizza },
  { key: 'parking', labelDe: 'Parkplatz', labelEn: 'Parking', Icon: SquareParking },
] as const satisfies readonly MarkerIconEntry[];

export type MarkerIconKey = (typeof MARKER_ICONS)[number]['key'];

const BY_KEY = new Map<string, MarkerIconEntry>(
  MARKER_ICONS.map((e) => [e.key, e]),
);

/** Look up a registry entry by key. Returns undefined for unknown/empty keys. */
export function markerIconByKey(
  key: string | null | undefined,
): MarkerIconEntry | undefined {
  if (!key) return undefined;
  return BY_KEY.get(key);
}
