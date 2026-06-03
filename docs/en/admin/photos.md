# Managing photos

Each tent can have multiple **photos** that visitors can view in a lightbox.
Photos are managed in the tent form.

> **Role:** **Contributor** and above can upload/manage photos.

## Photo grid

In the [tent form](/en/admin/tents) the photo area shows all existing images as a
grid:

![Photo management (grid)](/assets/screenshots/admin/photos-grid.png)

Per photo you can:

- **Reorder** – by dragging within the grid (determines the display order in the
  lightbox).
- **Rotate** – in 90° steps (handy for portrait phone photos).
- **Delete**.

## Upload on desktop (drag & drop)

On desktop, images can be dragged into the upload zone:

![Photo upload via drag & drop](/assets/screenshots/admin/photo-dropzone.png)

Alternatively a click opens the file dialog. Multiple files at once are
supported.

::: warning Desktop only
The drag-and-drop upload zone is disabled on mobile/tablet. There, direct
camera/gallery upload is available instead (see below).
:::

## Upload on mobile

On the **public** tent view there is (for authorized users) an **Add photo**
button that on a smartphone opens the **camera** directly
(`capture="environment"`) or the gallery. This lets you take photos on site.

## Image quality & lightbox

On upload, preview variants are generated. Whether visitors see the **full
resolution** or just a compressed preview in the lightbox is controlled by the
**`lightbox_full_size`** setting in the
[event settings](/en/admin/events#settings).

## Consent (GDPR)

On upload, a **consent timestamp** (`consent_recorded_at`) is stored. This
documents that consent to publish the photo existed. This information is also
included in the [ZIP export](/en/admin/import-export#_1-full-zip-export).

::: tip
Before uploading, make sure the necessary consent exists for any people shown –
responsibility for this lies with the organizer.
:::

## Next steps

- [Manage tents](/en/admin/tents)
- [Event settings](/en/admin/events#settings)
