import JSZip from 'jszip';
import { supabase, type Category, type Event } from './supabase';
import { photoPublicUrl } from './photos';
import { flattenTentCategories } from './tentCategories';
import {
  extFromStoragePath,
  tentFolderName,
  type ExportProgress,
  type ExportResult,
  type ExportTent,
} from './exportEvent';
import type { SnapshotData, SnapshotPhoto } from './snapshot';

/**
 * Client-side "web-optimized export". Unlike the original-resolution ZIP in
 * exportEvent.ts, this reproduces the **interactive app**: it bundles the
 * prebuilt single-file viewer (`/viewer.html`, see vite.viewer.config.ts) with
 * the event data injected inline and small (~1600px / q72) photos, so the whole
 * archive runs as static files with no backend.
 *
 * Layout of the produced ZIP:
 *   index.html              ← the viewer app + injected window.__KM_SNAPSHOT__
 *   photos/<n>_<slug>/01.jpg
 *   README.txt
 *
 * The pure helpers (paths, data shape, HTML injection) are unit-tested;
 * `buildEventSnapshot` does the Supabase fetches + photo downloads.
 */

/** Long-edge cap (px) for exported photos — see PhotoUrlOptions.height. */
export const SNAPSHOT_IMAGE_LONG_EDGE = 1600;
/** JPEG quality for exported photos. */
export const SNAPSHOT_IMAGE_QUALITY = 72;

/** Path within the ZIP for a stand's Nth photo: `photos/<n>_<slug>/NN.<ext>`. */
export function snapshotPhotoPath(
  tent: Pick<ExportTent, 'display_number' | 'slug'>,
  index: number,
  ext: string,
): string {
  return `photos/${tentFolderName(tent)}/${String(index + 1).padStart(2, '0')}.${ext}`;
}

/**
 * Inject the snapshot JSON into the viewer HTML by replacing the contents of
 * the `#km-snapshot-data` script tag. `<` is escaped to `<` so the JSON
 * can never close the script tag (and stays XSS-safe). Throws if the expected
 * placeholder tag is absent, rather than emitting a silently broken bundle.
 */
export function injectSnapshotData(html: string, data: SnapshotData): string {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const tagRe = /(<script id="km-snapshot-data"[^>]*>)[\s\S]*?(<\/script>)/;
  if (!tagRe.test(html)) {
    throw new Error(
      'viewer.html is missing the #km-snapshot-data placeholder tag.',
    );
  }
  return html.replace(tagRe, (_m, open: string, close: string) => `${open}${json}${close}`);
}

const README = `Kunstmeile – statischer Event-Export / static event export
============================================================

So nutzen Sie dieses Archiv / How to use this archive
-----------------------------------------------------
- Laden Sie den GESAMTEN Ordner auf einen beliebigen statischen Webserver
  hoch (z. B. als statischer Inhalt auf WordPress) und öffnen Sie index.html.
- Zum schnellen Ansehen genügt auch ein Doppelklick auf index.html.
- Upload the WHOLE folder to any static web server (e.g. as static content on
  WordPress) and open index.html. For a quick look you can also just
  double-click index.html.

Hinweis / Note
--------------
- Die Karten-Kacheln (OpenStreetMap) werden live aus dem Internet geladen –
  zum Anzeigen der Karte ist eine Internetverbindung nötig. Alle übrigen
  Inhalte (Texte, Fotos, Suche, Filter) funktionieren offline.
- The map tiles (OpenStreetMap) load live from the internet, so an internet
  connection is required to display the map. Everything else (text, photos,
  search, filters) works offline.
- Verschieben Sie index.html nicht aus dem Ordner – der Ordner "photos" muss
  daneben bleiben. / Keep index.html together with the "photos" folder.
`;

/**
 * Fetch the event's stands + photos, download web-optimized images, and bundle
 * them with the prebuilt viewer into a ZIP. A photo that fails to download is
 * skipped and reported in `result.skipped` (and omitted from the embedded data)
 * rather than aborting the whole export — same non-fatal pattern as buildEventZip.
 */
export async function buildEventSnapshot(
  event: Event,
  opts: { onProgress?: (p: ExportProgress) => void } = {},
): Promise<ExportResult> {
  // Fail fast if the viewer bundle isn't deployed (e.g. running the dev server
  // instead of a build/preview) before we do any expensive photo downloads.
  const viewerRes = await fetch('/viewer.html');
  if (!viewerRes.ok) {
    throw new Error(
      `Could not load /viewer.html (HTTP ${viewerRes.status}). Run a production build first.`,
    );
  }
  const viewerHtml = await viewerRes.text();

  const { data: tentRows, error: tentErr } = await supabase
    .from('tents')
    .select('*, tent_categories(category:categories(*))')
    .eq('event_id', event.id)
    .order('display_number', { ascending: true, nullsFirst: false });
  if (tentErr) throw new Error(tentErr.message);
  const tents = flattenTentCategories((tentRows ?? []) as never);

  const { data: categoryRows, error: catErr } = await supabase
    .from('categories')
    .select('*')
    .eq('event_id', event.id)
    .order('display_order', { ascending: true });
  if (catErr) throw new Error(catErr.message);
  const categories = (categoryRows ?? []) as Category[];

  // Pull each stand's photos up front so we know the total for progress.
  const perTent = await Promise.all(
    tents.map(async (tent) => {
      const { data: photos } = await supabase
        .from('tent_photos')
        .select('storage_path,display_order,caption_de,caption_en')
        .eq('tent_id', tent.id)
        .order('display_order', { ascending: true });
      return { tent, photos: photos ?? [] };
    }),
  );

  const total = perTent.reduce((n, p) => n + p.photos.length, 0);
  let done = 0;
  opts.onProgress?.({ done, total });

  const zip = new JSZip();
  const skipped: string[] = [];
  const photosByTentId: Record<string, SnapshotPhoto[]> = {};

  for (const { tent, photos } of perTent) {
    const entries: SnapshotPhoto[] = [];
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i]!;
      const file = snapshotPhotoPath(tent, i, extFromStoragePath(photo.storage_path));
      try {
        const res = await fetch(
          photoPublicUrl(photo.storage_path, {
            width: SNAPSHOT_IMAGE_LONG_EDGE,
            height: SNAPSHOT_IMAGE_LONG_EDGE,
            quality: SNAPSHOT_IMAGE_QUALITY,
          }),
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        zip.file(file, await res.blob());
        entries.push({
          file,
          caption_de: photo.caption_de,
          caption_en: photo.caption_en,
        });
      } catch {
        skipped.push(file);
      } finally {
        done++;
        opts.onProgress?.({ done, total });
      }
    }
    if (entries.length > 0) photosByTentId[tent.id] = entries;
  }

  const data: SnapshotData = { event, tents, categories, photosByTentId };
  zip.file('index.html', injectSnapshotData(viewerHtml, data));
  zip.file('README.txt', README);

  const blob = await zip.generateAsync({ type: 'blob' });
  return { blob, tentCount: tents.length, photoCount: total, skipped };
}
