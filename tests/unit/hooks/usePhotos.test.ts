import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePhotos } from '../../../src/hooks/usePhotos';

vi.mock('../../../src/lib/supabase', () => {
  const order = vi.fn().mockResolvedValue({
    data: [
      { storage_path: 'e1/t1/photo1.jpg', display_order: 0 },
      { storage_path: 'e1/t1/photo2.jpg', display_order: 1 },
    ],
    error: null,
  });
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  const getPublicUrl = vi.fn().mockImplementation((p: string) => ({
    data: { publicUrl: `https://cdn.example/${p}` },
  }));
  return {
    supabase: {
      from: vi.fn().mockReturnValue({ select }),
      storage: {
        from: vi.fn().mockReturnValue({ getPublicUrl }),
      },
    },
  };
});

describe('usePhotos', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches photo URLs for a given tent id', async () => {
    const { result } = renderHook(() => usePhotos('t1'));
    await waitFor(() => expect(result.current.length).toBe(2));
    expect(result.current[0]).toBe('https://cdn.example/e1/t1/photo1.jpg');
    expect(result.current[1]).toBe('https://cdn.example/e1/t1/photo2.jpg');
  });

  it('returns an empty array when tentId is undefined', () => {
    const { result } = renderHook(() => usePhotos(undefined));
    expect(result.current).toEqual([]);
  });

  it('refetches when the optional reloadKey arg changes', async () => {
    const { supabase } = await import('../../../src/lib/supabase');
    const fromMock = vi.mocked(supabase.from);

    const { rerender } = renderHook(
      ({ key }: { key: number }) => usePhotos('t1', key),
      { initialProps: { key: 0 } },
    );
    await waitFor(() =>
      expect(fromMock.mock.calls.filter((c) => c[0] === 'tent_photos').length).toBeGreaterThanOrEqual(1),
    );
    const callsBefore = fromMock.mock.calls.filter((c) => c[0] === 'tent_photos').length;

    rerender({ key: 1 });

    await waitFor(() =>
      expect(fromMock.mock.calls.filter((c) => c[0] === 'tent_photos').length).toBe(callsBefore + 1),
    );
  });
});
