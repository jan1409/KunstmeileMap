import { describe, expect, it } from 'vitest';
import {
  isValidCoord,
  clampZoom,
  computeBounds,
  colorForSlug,
  markerColorForCategories,
} from '../../../src/lib/map';

describe('isValidCoord', () => {
  it('accepts coordinates within range', () => {
    expect(isValidCoord(49.0, 8.4)).toBe(true);
    expect(isValidCoord(-89.9, 179.9)).toBe(true);
    expect(isValidCoord(0, 0)).toBe(true);
  });

  it('rejects out-of-range latitudes', () => {
    expect(isValidCoord(90.1, 0)).toBe(false);
    expect(isValidCoord(-90.1, 0)).toBe(false);
  });

  it('rejects out-of-range longitudes', () => {
    expect(isValidCoord(0, 180.1)).toBe(false);
    expect(isValidCoord(0, -180.1)).toBe(false);
  });

  it('rejects NaN, Infinity, and null', () => {
    expect(isValidCoord(NaN, 0)).toBe(false);
    expect(isValidCoord(0, Infinity)).toBe(false);
    expect(isValidCoord(null as unknown as number, 0)).toBe(false);
  });
});

describe('clampZoom', () => {
  it('clamps to OSM tile zoom bounds [1, 19]', () => {
    expect(clampZoom(0)).toBe(1);
    expect(clampZoom(20)).toBe(19);
    expect(clampZoom(17)).toBe(17);
  });

  it('rounds non-integers', () => {
    expect(clampZoom(17.4)).toBe(17);
    expect(clampZoom(17.6)).toBe(18);
  });
});

describe('computeBounds', () => {
  it('returns null for empty input', () => {
    expect(computeBounds([])).toBeNull();
  });

  it('returns a single-point bbox for one coord', () => {
    const b = computeBounds([{ lat: 49.0, lng: 8.4 }]);
    expect(b).toEqual({ south: 49.0, west: 8.4, north: 49.0, east: 8.4 });
  });

  it('computes correct bbox for multiple coords', () => {
    const b = computeBounds([
      { lat: 49.0, lng: 8.4 },
      { lat: 49.1, lng: 8.5 },
      { lat: 48.9, lng: 8.3 },
    ]);
    expect(b).toEqual({ south: 48.9, west: 8.3, north: 49.1, east: 8.5 });
  });
});

describe('colorForSlug', () => {
  it('returns a hex color from the palette', () => {
    expect(colorForSlug('painting')).toMatch(/^#[0-9a-f]{6}$/i);
  });
  it('is deterministic — same slug always returns same color', () => {
    expect(colorForSlug('sculpture')).toBe(colorForSlug('sculpture'));
  });
  it('differs across distinct slugs (sample)', () => {
    expect(colorForSlug('painting')).not.toBe(colorForSlug('photography'));
  });
});

describe('markerColorForCategories', () => {
  it('returns a default color for an empty list', () => {
    expect(markerColorForCategories([])).toBe('#888');
  });
  it('returns the color of the first category slug', () => {
    const first = markerColorForCategories([{ slug: 'painting' }]);
    expect(first).toBe(colorForSlug('painting'));
  });
});
