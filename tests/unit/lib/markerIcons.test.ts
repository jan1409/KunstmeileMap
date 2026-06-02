import { describe, expect, it } from 'vitest';
import {
  MARKER_ICONS,
  markerIconByKey,
  type MarkerIconKey,
} from '../../../src/lib/markerIcons';

describe('markerIcons registry', () => {
  it('exposes the curated set of icon keys', () => {
    const keys = MARKER_ICONS.map((e) => e.key);
    expect(keys).toEqual([
      'utensils',
      'burger',
      'ice-cream',
      'fish',
      'drink',
      'beer',
      'dessert',
      'coffee',
      'pizza',
      'parking',
    ]);
  });

  it('every entry has DE + EN labels and an Icon component', () => {
    for (const entry of MARKER_ICONS) {
      expect(entry.labelDe.length).toBeGreaterThan(0);
      expect(entry.labelEn.length).toBeGreaterThan(0);
      // lucide icons are forwardRef objects (typeof 'object') or functions.
      expect(['object', 'function']).toContain(typeof entry.Icon);
    }
  });

  it('markerIconByKey returns the matching entry', () => {
    const entry = markerIconByKey('parking');
    expect(entry?.key).toBe('parking');
  });

  it('markerIconByKey returns undefined for an unknown or null key', () => {
    expect(markerIconByKey('not-a-real-key')).toBeUndefined();
    expect(markerIconByKey(null)).toBeUndefined();
    expect(markerIconByKey(undefined)).toBeUndefined();
  });

  it('keys are unique', () => {
    const keys = MARKER_ICONS.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('exports MarkerIconKey as the union of registry keys (compile-time)', () => {
    // Smoke check that the type is usable; the real assertion is the build.
    const k: MarkerIconKey = 'fish';
    expect(k).toBe('fish');
  });
});
