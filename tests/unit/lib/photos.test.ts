import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getPublicUrlMock, storageFromMock } = vi.hoisted(() => ({
  getPublicUrlMock: vi.fn(),
  storageFromMock: vi.fn(),
}));

vi.mock('../../../src/lib/supabase', () => {
  storageFromMock.mockReturnValue({ getPublicUrl: getPublicUrlMock });
  return {
    supabase: {
      storage: { from: storageFromMock },
    },
  };
});

import { photoPublicUrl } from '../../../src/lib/photos';

describe('photoPublicUrl', () => {
  beforeEach(() => {
    getPublicUrlMock.mockReset();
    storageFromMock.mockClear();
    getPublicUrlMock.mockReturnValue({
      data: { publicUrl: 'https://cdn.example/path' },
    });
  });

  it('reads from the tent-photos bucket', () => {
    photoPublicUrl('e/t/a.jpg');
    expect(storageFromMock).toHaveBeenCalledWith('tent-photos');
  });

  it('passes no transform when no options are given (returns the original)', () => {
    photoPublicUrl('e/t/a.jpg');
    expect(getPublicUrlMock).toHaveBeenCalledWith('e/t/a.jpg', undefined);
  });

  it('passes width as a transform option', () => {
    photoPublicUrl('e/t/a.jpg', { width: 800 });
    expect(getPublicUrlMock).toHaveBeenCalledWith('e/t/a.jpg', {
      transform: { width: 800, quality: undefined },
    });
  });

  it('passes quality as a transform option', () => {
    photoPublicUrl('e/t/a.jpg', { quality: 60 });
    expect(getPublicUrlMock).toHaveBeenCalledWith('e/t/a.jpg', {
      transform: { width: undefined, quality: 60 },
    });
  });

  it('passes both width and quality together', () => {
    photoPublicUrl('e/t/a.jpg', { width: 800, quality: 75 });
    expect(getPublicUrlMock).toHaveBeenCalledWith('e/t/a.jpg', {
      transform: { width: 800, quality: 75 },
    });
  });

  it('returns the publicUrl from the underlying call', () => {
    getPublicUrlMock.mockReturnValue({
      data: { publicUrl: 'https://cdn.example/thumb' },
    });
    expect(photoPublicUrl('p')).toBe('https://cdn.example/thumb');
  });
});
