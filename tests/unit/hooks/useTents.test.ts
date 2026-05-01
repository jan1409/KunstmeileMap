import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const eqMock = vi.hoisted(() => vi.fn());

vi.mock('../../../src/lib/supabase', () => {
  const select = vi.fn().mockReturnValue({ eq: eqMock });
  return {
    supabase: {
      from: vi.fn().mockReturnValue({ select }),
    },
  };
});

import { useTents } from '../../../src/hooks/useTents';

const sampleResponse = [
  {
    id: 't1',
    event_id: 'evt-1',
    slug: 'kunst-stand',
    name: 'Kunststand',
    display_number: 1,
    position: { x: 0, y: 0, z: 0 },
    description_de: null,
    description_en: null,
    address: null,
    website_url: null,
    instagram_url: null,
    facebook_url: null,
    email_public: null,
    created_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z',
    created_by: null,
    updated_by: null,
    tent_categories: [
      {
        category: {
          id: 'c1',
          event_id: 'evt-1',
          slug: 'galerie',
          name_de: 'Galerie',
          name_en: 'Gallery',
          icon: '🎨',
          display_order: 1,
          created_at: '2026-01-01T00:00:00Z',
        },
      },
    ],
  },
];

describe('useTents', () => {
  beforeEach(() => {
    eqMock.mockReset();
  });

  it('returns tents with a flattened categories array when eventId is provided', async () => {
    eqMock.mockResolvedValue({ data: sampleResponse, error: null });
    const { result } = renderHook(() => useTents('evt-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tents).toHaveLength(1);
    expect(result.current.tents[0]!.categories.map((c) => c.slug)).toEqual(['galerie']);
    expect(result.current.tents[0]!.display_number).toBe(1);
  });

  it('returns an empty list when eventId is undefined and does not call supabase', () => {
    const { result } = renderHook(() => useTents(undefined));
    expect(result.current.tents).toEqual([]);
    expect(eqMock).not.toHaveBeenCalled();
  });
});
