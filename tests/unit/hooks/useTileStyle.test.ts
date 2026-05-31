import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTileStyle } from '../../../src/hooks/useTileStyle';

const STORAGE_KEY = 'kunstmeile.tileStyle';

describe('useTileStyle', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults to 'osm' when localStorage is empty", () => {
    const { result } = renderHook(() => useTileStyle());
    expect(result.current[0]).toBe('osm');
  });

  it("reads 'satellite' from localStorage on mount", () => {
    window.localStorage.setItem(STORAGE_KEY, 'satellite');
    const { result } = renderHook(() => useTileStyle());
    expect(result.current[0]).toBe('satellite');
  });

  it("falls back to 'osm' when localStorage holds an invalid value", () => {
    window.localStorage.setItem(STORAGE_KEY, 'aerial-photo');
    const { result } = renderHook(() => useTileStyle());
    expect(result.current[0]).toBe('osm');
  });

  it("persists the chosen style to localStorage when the setter is called", () => {
    const { result } = renderHook(() => useTileStyle());
    act(() => {
      result.current[1]('satellite');
    });
    expect(result.current[0]).toBe('satellite');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('satellite');
  });

  it("updates in-memory state when another tab dispatches a storage event", () => {
    const { result } = renderHook(() => useTileStyle());
    expect(result.current[0]).toBe('osm');
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: STORAGE_KEY,
          newValue: 'satellite',
        }),
      );
    });
    expect(result.current[0]).toBe('satellite');
  });
});
