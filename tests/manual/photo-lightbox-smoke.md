# Photo lightbox — Manual Smoke

Run against the Vercel preview for `feat/photo-lightbox`.

## Open / close

- [ ] Open a stand with several photos on the public map → side panel shows the thumbnails.
- [ ] Click a thumbnail (desktop): a full-screen, centered, dark overlay opens with the
      full-resolution image and an ✕ in the top-right.
- [ ] Click the ✕ → closes. Click a thumbnail again, then click the dark area around the
      image → closes. Clicking the image itself does NOT close.
- [ ] Press `Esc` → closes.

## Navigate

- [ ] With the lightbox open on a multi-photo stand, the ‹ / › arrows move between photos.
- [ ] `←` / `→` keys also move between photos.
- [ ] On mobile (or a touch screen), swipe left/right to move between photos.
- [ ] ‹ is disabled/greyed on the first photo; › is disabled on the last.
- [ ] On a stand with a single photo, no arrows appear.

## Quality

- [ ] The lightbox image is the full/original resolution (sharper than the thumbnail),
      and scales to fit the viewport without cropping (object-contain).
- [ ] Works on mobile (panel is bottom sheet) and desktop (panel is right rail); the
      lightbox covers the whole screen above the panel in both.
- [ ] Works in DE and EN locales (aria labels). No console errors.
