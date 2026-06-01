import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import '../../../src/lib/i18n';

const {
  listOrder,
  insertPhoto,
  deleteEq,
  deletePhoto,
  uploadFn,
  removeFn,
  getPublicUrlFn,
  rotateBlobMock,
} = vi.hoisted(() => ({
  listOrder: vi.fn(),
  insertPhoto: vi.fn(),
  deleteEq: vi.fn(),
  deletePhoto: vi.fn(),
  uploadFn: vi.fn(),
  removeFn: vi.fn(),
  getPublicUrlFn: vi.fn(),
  rotateBlobMock: vi.fn(),
}));

vi.mock('../../../src/lib/imageRotate', () => ({
  rotateImageBlob90CW: rotateBlobMock,
}));

vi.mock('../../../src/lib/supabase', () => {
  // tent_photos chain: from('tent_photos') exposes select/insert/delete.
  // - list: from(...).select('*').eq(...).order(...)
  // - insert: from(...).insert({...})
  // - delete: from(...).delete().eq(...)
  const listEq = vi.fn().mockReturnValue({ order: listOrder });
  const select = vi.fn().mockReturnValue({ eq: listEq });
  const deleteSelf = vi.fn().mockReturnValue({ eq: deleteEq });

  // storage chain: storage.from('tent-photos').upload/remove/getPublicUrl
  const storageBucket = {
    upload: uploadFn,
    remove: removeFn,
    getPublicUrl: getPublicUrlFn,
  };

  return {
    supabase: {
      from: vi.fn().mockReturnValue({
        select,
        insert: insertPhoto,
        delete: deleteSelf,
      }),
      storage: {
        from: vi.fn().mockReturnValue(storageBucket),
      },
    },
  };
});

import { PhotoUploadZone } from '../../../src/components/PhotoUploadZone';

const samplePhotos = [
  {
    id: 'p1',
    tent_id: 'tent-1',
    storage_path: 'evt-1/tent-1/a.jpg',
    display_order: 0,
  },
  {
    id: 'p2',
    tent_id: 'tent-1',
    storage_path: 'evt-1/tent-1/b.jpg',
    display_order: 1,
  },
];

describe('PhotoUploadZone', () => {
  beforeEach(() => {
    listOrder.mockReset();
    insertPhoto.mockReset();
    deleteEq.mockReset();
    deletePhoto.mockReset();
    uploadFn.mockReset();
    removeFn.mockReset();
    getPublicUrlFn.mockReset();
    rotateBlobMock.mockReset();

    listOrder.mockResolvedValue({ data: samplePhotos, error: null });
    insertPhoto.mockResolvedValue({ data: null, error: null });
    deleteEq.mockResolvedValue({ data: null, error: null });
    uploadFn.mockResolvedValue({ data: null, error: null });
    removeFn.mockResolvedValue({ data: null, error: null });
    getPublicUrlFn.mockImplementation((path: string) => ({
      data: { publicUrl: `https://cdn.example/${path}` },
    }));
    rotateBlobMock.mockImplementation(async () => new Blob(['rotated-bytes']));
    // Stub global fetch — the rotate handler downloads the current original
    // and feeds it to the canvas rotation helper.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        blob: () => Promise.resolve(new Blob(['original-bytes'])),
      }),
    );
  });

  it('renders existing photos as a grid with delete buttons and a file input', async () => {
    render(<PhotoUploadZone eventId="evt-1" tentId="tent-1" />);

    const imgs = await screen.findAllByRole('img');
    expect(imgs).toHaveLength(2);
    expect(imgs[0]).toHaveAttribute('src', 'https://cdn.example/evt-1/tent-1/a.jpg');
    expect(imgs[1]).toHaveAttribute('src', 'https://cdn.example/evt-1/tent-1/b.jpg');
    expect(screen.getAllByRole('button', { name: /remove|Foto entfernen/i })).toHaveLength(2);
    expect(screen.getByLabelText(/add photos|Fotos hinzufügen/i)).toBeInTheDocument();
  });

  it('requests grid-sized thumbnails via Supabase image transformations', async () => {
    render(<PhotoUploadZone eventId="evt-1" tentId="tent-1" />);
    await screen.findAllByRole('img');

    // Every public-url call for grid rendering should include a thumbnail width.
    expect(getPublicUrlFn).toHaveBeenCalled();
    for (const call of getPublicUrlFn.mock.calls) {
      const [, opts] = call;
      expect(opts).toBeDefined();
      expect(opts.transform.width).toBeTypeOf('number');
      expect(opts.transform.width).toBeGreaterThan(0);
      expect(opts.transform.width).toBeLessThanOrEqual(800);
    }
  });

  it('uploads each chosen file to storage, inserts a tent_photos row, and refreshes the list', async () => {
    const user = userEvent.setup();
    render(<PhotoUploadZone eventId="evt-1" tentId="tent-1" />);

    await screen.findAllByRole('img');
    expect(listOrder).toHaveBeenCalledTimes(1);

    const file = new File(['png-bytes'], 'photo.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText(/add photos|Fotos hinzufügen/i), file);

    await waitFor(() => expect(uploadFn).toHaveBeenCalledTimes(1));
    const [uploadPath, uploadedFile] = uploadFn.mock.calls[0]!;
    expect(uploadPath).toMatch(/^evt-1\/tent-1\/[0-9a-f-]+\.png$/);
    expect(uploadedFile).toBe(file);

    expect(insertPhoto).toHaveBeenCalledTimes(1);
    const insertedRow = insertPhoto.mock.calls[0]![0];
    expect(insertedRow.tent_id).toBe('tent-1');
    expect(insertedRow.storage_path).toBe(uploadPath);
    // Appended after the 2 existing photos.
    expect(insertedRow.display_order).toBe(2);

    // List re-fetched after the upload.
    await waitFor(() => expect(listOrder).toHaveBeenCalledTimes(2));
  });

  it('deletes the storage object and the tent_photos row when the remove button is clicked, and refreshes', async () => {
    const user = userEvent.setup();
    render(<PhotoUploadZone eventId="evt-1" tentId="tent-1" />);

    await screen.findAllByRole('img');
    expect(listOrder).toHaveBeenCalledTimes(1);

    await user.click(screen.getAllByRole('button', { name: /remove|Foto entfernen/i })[0]!);

    await waitFor(() => expect(removeFn).toHaveBeenCalledTimes(1));
    expect(removeFn).toHaveBeenCalledWith(['evt-1/tent-1/a.jpg']);
    expect(deleteEq).toHaveBeenCalledWith('id', 'p1');
    await waitFor(() => expect(listOrder).toHaveBeenCalledTimes(2));
  });

  it('surfaces the error message instead of silently failing when storage upload errors', async () => {
    const user = userEvent.setup();
    uploadFn.mockResolvedValue({
      data: null,
      error: { message: 'Storage quota exceeded' },
    });

    render(<PhotoUploadZone eventId="evt-1" tentId="tent-1" />);
    await screen.findAllByRole('img');

    const file = new File(['x'], 'big.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText(/add photos|Fotos hinzufügen/i), file);

    expect(await screen.findByRole('alert')).toHaveTextContent(/storage quota exceeded/i);
    expect(insertPhoto).not.toHaveBeenCalled();
  });

  it('rotates a photo: downloads the original, calls rotateImageBlob90CW, and upserts the rotated bytes', async () => {
    const user = userEvent.setup();
    render(<PhotoUploadZone eventId="evt-1" tentId="tent-1" />);
    await screen.findAllByRole('img');

    const rotateButtons = screen.getAllByRole('button', {
      name: /rotate|drehen/i,
    });
    expect(rotateButtons).toHaveLength(2);

    await user.click(rotateButtons[0]!);

    // Fetched the original (no transform) for the first photo. Uses
    // cache: 'no-store' so the browser never serves a stale pre-rotation
    // copy on subsequent rotations.
    await waitFor(() => expect(rotateBlobMock).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledTimes(1);
    const [fetchedUrl, fetchOpts] = (
      fetch as ReturnType<typeof vi.fn>
    ).mock.calls[0]!;
    expect(fetchedUrl).toContain('evt-1/tent-1/a.jpg');
    expect(fetchOpts).toMatchObject({ cache: 'no-store' });

    // Uploaded the rotated bytes back to the same storage path with upsert
    // and a no-cache cacheControl so the public view picks up changes.
    await waitFor(() => expect(uploadFn).toHaveBeenCalledTimes(1));
    const [uploadPath, _rotatedBlob, uploadOpts] = uploadFn.mock.calls[0]!;
    expect(uploadPath).toBe('evt-1/tent-1/a.jpg');
    expect(uploadOpts).toMatchObject({
      upsert: true,
      contentType: 'image/jpeg',
      cacheControl: '0',
    });

    // The rendered image src now carries a cache-busting `v=` token so the
    // browser refetches the rotated file instead of using the cached version.
    await waitFor(() => {
      const img = screen.getAllByRole('img')[0]!;
      expect(img.getAttribute('src')).toMatch(/[?&]v=\d+/);
    });
  });

  it('rotating a photo twice in a row fetches different URLs (cache-buster bumps each round)', async () => {
    const user = userEvent.setup();
    render(<PhotoUploadZone eventId="evt-1" tentId="tent-1" />);
    await screen.findAllByRole('img');

    const rotateButton = () =>
      screen.getAllByRole('button', { name: /rotate|drehen/i })[0]!;

    await user.click(rotateButton());
    await waitFor(() => expect(uploadFn).toHaveBeenCalledTimes(1));
    // Wait for the rotating state to clear so the button is enabled again.
    await waitFor(() =>
      expect((rotateButton() as HTMLButtonElement).disabled).toBe(false),
    );

    await user.click(rotateButton());
    await waitFor(() => expect(uploadFn).toHaveBeenCalledTimes(2));

    const [firstUrl] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const [secondUrl] = (fetch as ReturnType<typeof vi.fn>).mock.calls[1]!;
    // Second fetch must be a distinct URL (with the bumped cacheKey appended)
    // so the browser doesn't serve a stale pre-rotation copy.
    expect(firstUrl).not.toBe(secondUrl);
    expect(secondUrl).toMatch(/[?&]v=\d+/);
  });

  it('surfaces a rotation error toast when the upload of rotated bytes fails', async () => {
    const user = userEvent.setup();
    uploadFn.mockResolvedValue({
      data: null,
      error: { message: 'Quota exceeded' },
    });

    render(<PhotoUploadZone eventId="evt-1" tentId="tent-1" />);
    await screen.findAllByRole('img');

    await user.click(
      screen.getAllByRole('button', { name: /rotate|drehen/i })[0]!,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/Quota exceeded/);
  });
});
