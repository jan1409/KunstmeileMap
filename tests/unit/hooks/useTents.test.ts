import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTents } from '../../../src/hooks/useTents';

vi.mock('../../../src/lib/supabase', () => {
  const eq = vi.fn().mockResolvedValue({
    data: [
      { id: 't1', name: 'Tent A', position: { x: 1, y: 0, z: 1 }, event_id: 'e1' },
      { id: 't2', name: 'Tent B', position: { x: 2, y: 0, z: 2 }, event_id: 'e1' },
    ],
    error: null,
  });
  const select = vi.fn().mockReturnValue({ eq });
  return { supabase: { from: vi.fn().mockReturnValue({ select }) } };
});

describe('useTents', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches tents for the given event id', async () => {
    const { result } = renderHook(() => useTents('e1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tents).toHaveLength(2);
    expect(result.current.tents[0]?.name).toBe('Tent A');
    expect(result.current.error).toBeNull();
  });

  it('returns an empty array immediately when eventId is undefined', () => {
    const { result } = renderHook(() => useTents(undefined));
    expect(result.current.tents).toEqual([]);
    expect(result.current.loading).toBe(false);
  });
});
