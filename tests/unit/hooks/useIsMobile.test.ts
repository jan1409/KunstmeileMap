import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useIsMobile } from '../../../src/hooks/useIsMobile';

interface FakeMQL {
  matches: boolean;
  addEventListener: (evt: 'change', cb: (e: MediaQueryListEvent) => void) => void;
  removeEventListener: (evt: 'change', cb: (e: MediaQueryListEvent) => void) => void;
  fire: (matches: boolean) => void;
}

function installMatchMedia(initial: boolean): FakeMQL {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mql: FakeMQL = {
    matches: initial,
    addEventListener: (_evt, cb) => {
      listeners.add(cb);
    },
    removeEventListener: (_evt, cb) => {
      listeners.delete(cb);
    },
    fire: (matches) => {
      mql.matches = matches;
      listeners.forEach((cb) => cb({ matches } as MediaQueryListEvent));
    },
  };
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mql));
  return mql;
}

describe('useIsMobile', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns true when the (max-width: 767px) query matches', () => {
    installMatchMedia(true);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('returns false when the query does not match', () => {
    installMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('updates when the media query changes', () => {
    const mql = installMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
    act(() => mql.fire(true));
    expect(result.current).toBe(true);
    act(() => mql.fire(false));
    expect(result.current).toBe(false);
  });

  it('removes the change listener on unmount', () => {
    const mql = installMatchMedia(true);
    const { unmount } = renderHook(() => useIsMobile());
    unmount();
    expect(() => mql.fire(false)).not.toThrow();
  });
});
