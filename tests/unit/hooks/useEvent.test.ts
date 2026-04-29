import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useEvent } from '../../../src/hooks/useEvent';

vi.mock('../../../src/lib/supabase', () => {
  const single = vi.fn().mockResolvedValue({
    data: { id: 'e1', slug: 'kunstmeile-2026', title_de: 'Kunstmeile 2026', status: 'published' },
    error: null,
  });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  return {
    supabase: {
      from: vi.fn().mockReturnValue({ select }),
    },
  };
});

describe('useEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches an event by slug', async () => {
    const { result } = renderHook(() => useEvent('kunstmeile-2026'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.event?.slug).toBe('kunstmeile-2026');
    expect(result.current.error).toBeNull();
  });

  it('fetches the featured event when slug is undefined', async () => {
    const { result } = renderHook(() => useEvent(undefined));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.event?.slug).toBe('kunstmeile-2026');
    expect(result.current.error).toBeNull();
  });
});
