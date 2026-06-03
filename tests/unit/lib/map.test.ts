import { describe, expect, it } from 'vitest';
import L from 'leaflet';
import {
  isValidCoord,
  clampZoom,
  computeBounds,
  colorForSlug,
  isHexColor,
  markerColorForCategories,
  MARKER_DETAIL_ZOOM,
  TENT_FOCUS_ZOOM,
  TILE_CONFIGS,
  focusedCenter,
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

describe('isHexColor', () => {
  it('accepts a 6-digit #rrggbb hex', () => {
    expect(isHexColor('#e57373')).toBe(true);
    expect(isHexColor('#FFFFFF')).toBe(true);
  });
  it('rejects malformed values', () => {
    expect(isHexColor('e57373')).toBe(false); // missing #
    expect(isHexColor('#fff')).toBe(false); // 3-digit shorthand
    expect(isHexColor('#gggggg')).toBe(false); // non-hex digits
    expect(isHexColor('')).toBe(false);
    expect(isHexColor('red')).toBe(false);
  });
});

describe('markerColorForCategories', () => {
  it('returns a default color for an empty list', () => {
    expect(markerColorForCategories([])).toBe('#888');
  });
  it('returns the color of the first category slug when no color is set', () => {
    const first = markerColorForCategories([{ slug: 'painting' }]);
    expect(first).toBe(colorForSlug('painting'));
  });
  it('prefers an explicit valid hex color over the slug hash', () => {
    expect(
      markerColorForCategories([{ slug: 'painting', color: '#123456' }]),
    ).toBe('#123456');
  });
  it('falls back to the slug hash when color is null', () => {
    expect(
      markerColorForCategories([{ slug: 'painting', color: null }]),
    ).toBe(colorForSlug('painting'));
  });
  it('falls back to the slug hash when color is an invalid hex', () => {
    expect(
      markerColorForCategories([{ slug: 'painting', color: 'not-a-color' }]),
    ).toBe(colorForSlug('painting'));
  });
});

describe('MARKER_DETAIL_ZOOM', () => {
  it('is the integer zoom level at and above which markers show their display number', () => {
    expect(MARKER_DETAIL_ZOOM).toBe(20);
  });
  it('is an integer', () => {
    expect(Number.isInteger(MARKER_DETAIL_ZOOM)).toBe(true);
  });
});

describe('TENT_FOCUS_ZOOM', () => {
  it('is at least MARKER_DETAIL_ZOOM so the full numbered badge is visible', () => {
    expect(TENT_FOCUS_ZOOM).toBeGreaterThanOrEqual(MARKER_DETAIL_ZOOM);
  });
  it('is an integer', () => {
    expect(Number.isInteger(TENT_FOCUS_ZOOM)).toBe(true);
  });
});

describe('TILE_CONFIGS', () => {
  it('exposes a non-empty OSM tile url with {z}/{x}/{y} placeholders', () => {
    const { url, attribution } = TILE_CONFIGS.osm;
    expect(url).toContain('{z}');
    expect(url).toContain('{x}');
    expect(url).toContain('{y}');
    expect(attribution.length).toBeGreaterThan(0);
  });

  it('exposes a non-empty satellite tile url with {z}/{x}/{y} placeholders', () => {
    const { url, attribution } = TILE_CONFIGS.satellite;
    expect(url).toContain('{z}');
    expect(url).toContain('{x}');
    expect(url).toContain('{y}');
    expect(attribution.length).toBeGreaterThan(0);
  });
});

describe('focusedCenter', () => {
  // Trivial 1:1 projection used in both tests — pixel (x,y) <-> latlng (y/100, x/100).
  // The map is W=600, H=900 so offsetY = H/6 = 150.
  function makeFakeMap(opts: {
    project: (latlng: L.LatLng, z: number) => L.Point;
  }): L.Map {
    return {
      getSize: () => L.point(600, 900),
      project: opts.project,
      unproject: (pt: L.Point) => L.latLng(pt.y / 100, pt.x / 100),
    } as unknown as L.Map;
  }

  it('shifts the projected point south by H/6 pixels (upper-third placement)', () => {
    // Tent projects to the dead-center pixel (300, 450).
    const fakeMap = makeFakeMap({
      project: () => L.point(300, 450),
    });
    const result = focusedCenter(fakeMap, L.latLng(4.5, 3.0), 20);
    // Shifted point is (300, 600) -> unprojected latlng (6.0, 3.0).
    expect(result.lat).toBeCloseTo(6.0);
  });

  it('preserves the x coordinate (horizontal center)', () => {
    const fakeMap = makeFakeMap({
      project: () => L.point(300, 450),
    });
    const result = focusedCenter(fakeMap, L.latLng(4.5, 3.0), 20);
    // x unchanged at 300 -> unprojected lng = 3.0.
    expect(result.lng).toBeCloseTo(3.0);
  });
});
