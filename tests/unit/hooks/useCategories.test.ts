import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCategories } from '../../../src/hooks/useCategories';

vi.mock('../../../src/lib/supabase', () => {
  const order = vi.fn().mockResolvedValue({
    data: [
      { id: 'c1', name_de: 'Holzkunst', display_order: 1, event_id: 'e1' },
      { id: 'c2', name_de: 'Keramik', display_order: 2, event_id: 'e1' },
    ],
    error: null,
  });
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  return { supabase: { from: vi.fn().mockReturnValue({ select }) } };
});

describe('useCategories', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches categories ordered by display_order for the given event id', async () => {
    const { result } = renderHook(() => useCategories('e1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.categories).toHaveLength(2);
    expect(result.current.categories[0]?.name_de).toBe('Holzkunst');
    expect(result.current.error).toBeNull();
  });

  it('returns an empty array immediately when eventId is undefined', () => {
    const { result } = renderHook(() => useCategories(undefined));
    expect(result.current.categories).toEqual([]);
    expect(result.current.loading).toBe(false);
  });
});
