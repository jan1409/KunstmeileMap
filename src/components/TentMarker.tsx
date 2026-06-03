import { markerIconByKey } from '../lib/markerIcons';

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
  /**
   * Optional special-symbol key from the marker-icon registry. When set and
   * recognized, the full badge shows that symbol instead of the display
   * number. Unknown keys fall back to the number. Ignored by the `'dot'`
   * variant, which stays a plain dot (too small for a legible glyph).
   */
  iconKey?: string | null;
  /**
   * When true the marker is the currently selected tent: it renders larger and
   * with a pulsing ring so it stands out from its neighbours. The pulse is
   * gated behind `motion-safe:` so reduced-motion users still get the size cue
   * without the animation. MapView enlarges the divIcon box/anchor to match.
   */
  selected?: boolean;
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
  iconKey,
  selected = false,
}: Props) {
  if (variant === 'dot') {
    // 24×24 outer hit-area for touch accessibility (WCAG 2.5.5),
    // with a 12×12 colored circle centered inside. When selected the circle
    // grows and gains a pulsing ring so it stays distinguishable when zoomed
    // out below the detail threshold.
    if (selected) {
      return (
        <div
          aria-label={ariaLabel}
          className="relative flex h-8 w-8 items-center justify-center"
        >
          <span
            style={{ backgroundColor: color }}
            className="absolute inline-flex h-5 w-5 rounded-full opacity-60 motion-safe:animate-ping"
          />
          <div
            style={{ backgroundColor: color }}
            className="relative h-4 w-4 rounded-full border-2 border-white shadow"
          />
        </div>
      );
    }
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

  const iconEntry = markerIconByKey(iconKey);
  const glyph = iconEntry ? (
    <iconEntry.Icon
      size={selected ? 20 : 16}
      strokeWidth={2.5}
      aria-hidden="true"
    />
  ) : (
    (displayNumber ?? '·')
  );

  if (selected) {
    // 36×36 badge with a pulsing ring behind it. The wrapper carries the
    // aria-label and background color so existing selectors (root style, label)
    // keep working.
    return (
      <div
        aria-label={ariaLabel}
        style={{ backgroundColor: color }}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-sm font-semibold text-zinc-900 shadow-md"
      >
        <span
          style={{ backgroundColor: color }}
          className="absolute inset-0 inline-flex rounded-full opacity-60 motion-safe:animate-ping"
        />
        <span className="relative flex items-center justify-center">
          {glyph}
        </span>
      </div>
    );
  }

  return (
    <div
      aria-label={ariaLabel}
      style={{ backgroundColor: color }}
      className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs font-semibold text-zinc-900 shadow"
    >
      {glyph}
    </div>
  );
}
