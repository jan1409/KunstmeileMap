import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDirtyPositions } from '../../../src/hooks/useDirtyPositions';

const originals = {
  a: { lat: 53.1, lng: 9.1 },
  b: { lat: 53.2, lng: 9.2 },
};

describe('useDirtyPositions', () => {
  it('starts with zero dirty entries', () => {
    const { result } = renderHook(() => useDirtyPositions(originals));
    expect(result.current.dirtyCount).toBe(0);
    expect(result.current.isDirty('a')).toBe(false);
    expect([...result.current.dirtyIds]).toEqual([]);
  });

  it('set() marks the id dirty and returns the new coords', () => {
    const { result } = renderHook(() => useDirtyPositions(originals));
    act(() => result.current.set('a', { lat: 53.99, lng: 9.99 }));
    expect(result.current.isDirty('a')).toBe(true);
    expect(result.current.dirtyCount).toBe(1);
    expect(result.current.getCoords('a')).toEqual({ lat: 53.99, lng: 9.99 });
    // Other ids unaffected.
    expect(result.current.isDirty('b')).toBe(false);
    expect(result.current.getCoords('b')).toEqual(originals.b);
  });

  it('set() to coords matching the original (within 1e-9) drops the entry', () => {
    const { result } = renderHook(() => useDirtyPositions(originals));
    act(() => result.current.set('a', { lat: 53.99, lng: 9.99 }));
    expect(result.current.isDirty('a')).toBe(true);
    act(() =>
      result.current.set('a', {
        lat: 53.1 + 1e-10,
        lng: 9.1 - 1e-10,
      }),
    );
    expect(result.current.isDirty('a')).toBe(false);
    expect(result.current.dirtyCount).toBe(0);
  });

  it('getCoords() returns originals for ids never edited', () => {
    const { result } = renderHook(() => useDirtyPositions(originals));
    expect(result.current.getCoords('b')).toEqual({ lat: 53.2, lng: 9.2 });
  });

  it('revert(id) removes a single entry, leaving other dirty entries', () => {
    const { result } = renderHook(() => useDirtyPositions(originals));
    act(() => {
      result.current.set('a', { lat: 1, lng: 2 });
      result.current.set('b', { lat: 3, lng: 4 });
    });
    expect(result.current.dirtyCount).toBe(2);
    act(() => result.current.revert('a'));
    expect(result.current.isDirty('a')).toBe(false);
    expect(result.current.isDirty('b')).toBe(true);
    expect(result.current.getCoords('a')).toEqual(originals.a);
  });

  it('revertAll() clears every entry', () => {
    const { result } = renderHook(() => useDirtyPositions(originals));
    act(() => {
      result.current.set('a', { lat: 1, lng: 2 });
      result.current.set('b', { lat: 3, lng: 4 });
    });
    act(() => result.current.revertAll());
    expect(result.current.dirtyCount).toBe(0);
    expect(result.current.isDirty('a')).toBe(false);
    expect(result.current.isDirty('b')).toBe(false);
  });

  it('commit(ids) drops only the listed ids; other dirty entries remain', () => {
    const { result } = renderHook(() => useDirtyPositions(originals));
    act(() => {
      result.current.set('a', { lat: 1, lng: 2 });
      result.current.set('b', { lat: 3, lng: 4 });
    });
    act(() => result.current.commit(['a']));
    expect(result.current.isDirty('a')).toBe(false);
    expect(result.current.isDirty('b')).toBe(true);
    expect(result.current.dirtyCount).toBe(1);
  });
});
