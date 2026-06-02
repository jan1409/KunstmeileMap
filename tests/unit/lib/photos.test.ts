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

  it('passes width as a transform option with resize=contain', () => {
    photoPublicUrl('e/t/a.jpg', { width: 800 });
    expect(getPublicUrlMock).toHaveBeenCalledWith('e/t/a.jpg', {
      transform: { width: 800, resize: 'contain' },
    });
  });

  it('passes quality as a transform option with resize=contain', () => {
    photoPublicUrl('e/t/a.jpg', { quality: 60 });
    expect(getPublicUrlMock).toHaveBeenCalledWith('e/t/a.jpg', {
      transform: { quality: 60, resize: 'contain' },
    });
  });

  it('omits undefined keys from the transform object', () => {
    photoPublicUrl('e/t/a.jpg', { width: 800, quality: undefined });
    const [, opts] = getPublicUrlMock.mock.calls[0]!;
    expect(opts.transform.width).toBe(800);
    expect(opts.transform.resize).toBe('contain');
    expect('quality' in opts.transform).toBe(false);
  });

  it('passes both width and quality together with resize=contain', () => {
    photoPublicUrl('e/t/a.jpg', { width: 800, quality: 75 });
    expect(getPublicUrlMock).toHaveBeenCalledWith('e/t/a.jpg', {
      transform: { width: 800, quality: 75, resize: 'contain' },
    });
  });

  it('passes height as a transform option with resize=contain', () => {
    photoPublicUrl('e/t/a.jpg', { height: 1200 });
    expect(getPublicUrlMock).toHaveBeenCalledWith('e/t/a.jpg', {
      transform: { height: 1200, resize: 'contain' },
    });
  });

  it('caps the long edge by passing width+height together (resize=contain)', () => {
    photoPublicUrl('e/t/a.jpg', { width: 1600, height: 1600, quality: 72 });
    expect(getPublicUrlMock).toHaveBeenCalledWith('e/t/a.jpg', {
      transform: { width: 1600, height: 1600, quality: 72, resize: 'contain' },
    });
  });

  it('returns the publicUrl from the underlying call', () => {
    getPublicUrlMock.mockReturnValue({
      data: { publicUrl: 'https://cdn.example/thumb' },
    });
    expect(photoPublicUrl('p')).toBe('https://cdn.example/thumb');
  });

  it('appends ?v= cache-busting token when cacheKey is set (no existing query string)', () => {
    getPublicUrlMock.mockReturnValue({
      data: { publicUrl: 'https://cdn.example/thumb' },
    });
    expect(photoPublicUrl('p', { cacheKey: 7 })).toBe(
      'https://cdn.example/thumb?v=7',
    );
  });

  it('appends &v= cache-busting token when cacheKey is set and URL already has a query string', () => {
    getPublicUrlMock.mockReturnValue({
      data: { publicUrl: 'https://cdn.example/thumb?width=600' },
    });
    expect(photoPublicUrl('p', { width: 600, cacheKey: 3 })).toBe(
      'https://cdn.example/thumb?width=600&v=3',
    );
  });

  it('skips the cache-busting token when cacheKey is undefined', () => {
    getPublicUrlMock.mockReturnValue({
      data: { publicUrl: 'https://cdn.example/thumb?width=600' },
    });
    expect(photoPublicUrl('p', { width: 600 })).toBe(
      'https://cdn.example/thumb?width=600',
    );
  });
});
