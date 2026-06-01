/**
 * Client-side 90° clockwise rotation of an image blob via canvas.
 *
 * Used by the admin photo zone to fix the orientation of a tent photo without
 * a server round-trip beyond the upload itself. The output is always JPEG —
 * the caller is expected to overwrite the same storage path with the rotated
 * bytes and bump a cache-buster so the rendered URL refreshes.
 */
export async function rotateImageBlob90CW(input: Blob): Promise<Blob> {
  const img = await blobToImage(input);
  const canvas = document.createElement('canvas');
  // Swap dimensions for the 90° rotation: the new canvas is `naturalHeight`
  // wide and `naturalWidth` tall.
  canvas.width = img.naturalHeight;
  canvas.height = img.naturalWidth;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to acquire 2D rendering context');
  // Translate to the right edge of the new canvas, then rotate CW. After
  // these two transforms the source image's (0,0) corner lines up with the
  // canvas's top-left when drawn at (0,0).
  ctx.translate(canvas.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(img, 0, 0);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) =>
        b
          ? resolve(b)
          : reject(new Error('Failed to encode rotated image as JPEG')),
      'image/jpeg',
      0.92,
    );
  });
}

function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for rotation'));
    };
    img.src = url;
  });
}
