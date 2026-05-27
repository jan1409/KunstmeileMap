interface Props {
  displayNumber: number | null;
  color: string;
  ariaLabel: string;
  /**
   * `'full'` (default): 28×28 badge with the display number inside.
   * `'dot'`: 24×24 hit-area wrapper around a 12×12 colored circle, no number.
   * Used by MapView/TentMapEditor to swap detail level on zoom.
   */
  variant?: 'dot' | 'full';
}

/**
 * Pure DOM tent marker. Rendered into a Leaflet `divIcon` via
 * `renderToString` — has no Leaflet runtime dependencies and tests cleanly in
 * jsdom.
 */
export function TentMarker({
  displayNumber,
  color,
  ariaLabel,
  variant = 'full',
}: Props) {
  if (variant === 'dot') {
    // 24×24 outer hit-area for touch accessibility (WCAG 2.5.5),
    // with a 12×12 colored circle centered inside.
    return (
      <div
        aria-label={ariaLabel}
        className="flex h-6 w-6 items-center justify-center"
      >
        <div
          style={{ backgroundColor: color }}
          className="h-3 w-3 rounded-full border-2 border-white shadow"
        />
      </div>
    );
  }
  return (
    <div
      aria-label={ariaLabel}
      style={{ backgroundColor: color }}
      className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs font-semibold text-zinc-900 shadow"
    >
      {displayNumber ?? '·'}
    </div>
  );
}
