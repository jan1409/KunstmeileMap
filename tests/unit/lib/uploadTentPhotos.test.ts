import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadTentPhotos } from '../../../src/lib/photos';

const { uploadMock, insertMock, fromMock } = vi.hoisted(() => ({
  uploadMock: vi.fn(),
  insertMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock('../../../src/lib/supabase', () => ({
  supabase: {
    storage: { from: vi.fn(() => ({ upload: uploadMock })) },
    from: fromMock,
  },
}));

function imageFile(name: string) {
  return new File(['data'], name, { type: 'image/jpeg' });
}

describe('uploadTentPhotos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadMock.mockResolvedValue({ error: null });
    insertMock.mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ insert: insertMock });
  });

  it('uploads each file and inserts a row with ordered display_order', async () => {
    const files = [imageFile('a.jpg'), imageFile('b.png'), imageFile('c.jpg')];
    const result = await uploadTentPhotos(files, 'e1', 't1', 5);

    expect(result).toEqual({ uploaded: 3, error: null });
    expect(uploadMock).toHaveBeenCalledTimes(3);
    expect(insertMock).toHaveBeenCalledTimes(3);

    const orders = insertMock.mock.calls.map((c) => c[0].display_order);
    expect(orders).toEqual([5, 6, 7]);
    for (const [row] of insertMock.mock.calls) {
      expect(row.tent_id).toBe('t1');
      expect(row.storage_path).toMatch(/^e1\/t1\/.+\.(jpg|png)$/);
    }
  });

  it('skips a failed upload but keeps uploading the rest and reports the error', async () => {
    uploadMock
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'boom' } })
      .mockResolvedValueOnce({ error: null });
    const files = [imageFile('a.jpg'), imageFile('b.jpg'), imageFile('c.jpg')];

    const result = await uploadTentPhotos(files, 'e1', 't1', 0);

    expect(result).toEqual({ uploaded: 2, error: 'boom' });
    // No row inserted for the failed file; orders stay contiguous (0, 1).
    expect(insertMock).toHaveBeenCalledTimes(2);
    expect(insertMock.mock.calls.map((c) => c[0].display_order)).toEqual([0, 1]);
  });
});
