interface Props {
  displayNumber: number | null;
  color: string;
  ariaLabel: string;
}

/**
 * Pure DOM tent marker. Rendered into a Leaflet `divIcon` via
 * `renderToString` — has no Leaflet runtime dependencies and tests cleanly in
 * jsdom.
 */
export function TentMarker({ displayNumber, color, ariaLabel }: Props) {
  return (
    <div
      aria-label={ariaLabel}
      style={{ backgroundColor: color }}
      className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs font-semibold text-white shadow"
    >
      {displayNumber ?? '·'}
    </div>
  );
}
