import JSZip from 'jszip';
import { supabase, type Event, type TentWithCategories } from './supabase';
import { photoPublicUrl } from './photos';
import { flattenTentCategories } from './tentCategories';

/**
 * Client-side "export this event" builder. Produces a downloadable ZIP whose
 * layout is:
 *
 *   index.html                         ← overview, links to each stand
 *   <number>_<slug>/index.html         ← one formatted page per stand
 *   <number>_<slug>/<number>_<slug>_photo_01.jpg   ← original-resolution photos
 *
 * The HTML/naming helpers are pure (unit-tested); `buildEventZip` does the
 * Supabase fetches + photo downloads and is the only part that touches the
 * network. Mirrors the existing Excel-export download pattern.
 */

export type ExportTent = TentWithCategories;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Folder name for a stand: `<display_number>_<slug>` ("x" when unnumbered). */
export function tentFolderName(tent: Pick<ExportTent, 'display_number' | 'slug'>): string {
  return `${tent.display_number ?? 'x'}_${tent.slug}`;
}

/** Photo file name: same `<number>_<slug>` prefix + `_photo_NN.<ext>`. */
export function photoFileName(
  tent: Pick<ExportTent, 'display_number' | 'slug'>,
  index: number,
  ext: string,
): string {
  return `${tentFolderName(tent)}_photo_${String(index + 1).padStart(2, '0')}.${ext}`;
}

/** Lowercased file extension from a storage path; defaults to `jpg`. */
export function extFromStoragePath(path: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(path);
  return match ? match[1]!.toLowerCase() : 'jpg';
}

const STYLE = `
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
         margin: 0; padding: 2rem; line-height: 1.5; max-width: 60rem;
         margin-inline: auto; color: #1a1a1a; background: #fafafa; }
  a { color: #1565c0; }
  .back { display: inline-block; margin-bottom: 1rem; font-size: .9rem; }
  h1 { margin: 0 0 .25rem; }
  h2 { margin: 2rem 0 .5rem; font-size: 1.1rem; }
  .num { color: #888; font-weight: 600; }
  .meta { color: #666; margin: 0 0 1.5rem; }
  .cats { margin: .25rem 0 1rem; }
  .cat { display: inline-block; background: #eee; border-radius: 4px;
         padding: 1px 8px; margin-right: 4px; font-size: .85rem; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: .35rem 1rem; margin: 1rem 0; }
  dt { color: #666; font-size: .85rem; }
  dd { margin: 0; }
  .desc { white-space: pre-line; }
  .grid { display: flex; flex-wrap: wrap; gap: .75rem; }
  .grid img { height: 220px; width: auto; border-radius: 6px; box-shadow: 0 1px 4px rgba(0,0,0,.2); }
  ol.tents { padding-left: 1.25rem; }
  ol.tents li { margin: .35rem 0; }
`.trim();

function htmlDoc(lang: string, title: string, body: string): string {
  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${STYLE}</style>
</head>
<body>
${body}
</body>
</html>`;
}

/** A `<dt>/<dd>` pair, or '' when the value is empty. */
function field(labelDe: string, labelEn: string, valueHtml: string | null): string {
  if (!valueHtml) return '';
  return `<dt>${escapeHtml(labelDe)} / ${escapeHtml(labelEn)}</dt><dd>${valueHtml}</dd>`;
}

function link(url: string): string {
  return `<a href="${escapeHtml(url)}" rel="noopener">${escapeHtml(url)}</a>`;
}

/** Build the per-stand HTML page. `photoFiles` are local file names (same folder). */
export function renderTentPageHtml(
  tent: ExportTent,
  event: Event,
  photoFiles: string[],
): string {
  const number = tent.display_number != null ? `<span class="num">#${tent.display_number}</span> ` : '';
  const eventTitle = event.title_de;

  const cats = (tent.categories ?? [])
    .map((c) => {
      const de = c.name_de;
      const en = c.name_en && c.name_en !== c.name_de ? ` / ${c.name_en}` : '';
      return `<span class="cat">${escapeHtml(de)}${escapeHtml(en)}</span>`;
    })
    .join('');

  const coords =
    tent.lat != null && tent.lng != null
      ? `${tent.lat}, ${tent.lng}`
      : null;

  const fields = [
    field('Ansprechperson', 'Contact person', tent.contact_person ? escapeHtml(tent.contact_person) : null),
    field('Adresse', 'Address', tent.address ? escapeHtml(tent.address) : null),
    field('Website', 'Website', tent.website_url ? link(tent.website_url) : null),
    field('Instagram', 'Instagram', tent.instagram_url ? link(tent.instagram_url) : null),
    field('Facebook', 'Facebook', tent.facebook_url ? link(tent.facebook_url) : null),
    field('E-Mail', 'Email', tent.email_public ? escapeHtml(tent.email_public) : null),
    field('Koordinaten', 'Coordinates', coords ? escapeHtml(coords) : null),
  ].join('');

  const descDe = tent.description_de
    ? `<h2>Beschreibung (DE)</h2><p class="desc">${escapeHtml(tent.description_de)}</p>`
    : '';
  const descEn = tent.description_en
    ? `<h2>Description (EN)</h2><p class="desc">${escapeHtml(tent.description_en)}</p>`
    : '';

  const gallery =
    photoFiles.length > 0
      ? `<h2>Fotos / Photos</h2><div class="grid">${photoFiles
          .map((f) => `<a href="${escapeHtml(f)}"><img src="${escapeHtml(f)}" alt=""></a>`)
          .join('')}</div>`
      : '';

  const body = `<a class="back" href="../index.html">&larr; ${escapeHtml(eventTitle)}</a>
<h1>${number}${escapeHtml(tent.name)}</h1>
${cats ? `<div class="cats">${cats}</div>` : ''}
<dl>${fields}</dl>
${descDe}
${descEn}
${gallery}`;

  const title = `${tent.display_number != null ? `#${tent.display_number} ` : ''}${tent.name} — ${eventTitle}`;
  return htmlDoc('de', title, body);
}

/** Build the root overview page listing every stand. */
export function renderOverviewHtml(
  event: Event,
  entries: Array<{ tent: ExportTent; folderName: string }>,
): string {
  const title = event.title_en && event.title_en !== event.title_de
    ? `${event.title_de} / ${event.title_en}`
    : event.title_de;

  const metaParts = [
    String(event.year),
    event.starts_at && event.ends_at ? `${event.starts_at} – ${event.ends_at}` : null,
    [event.venue_name, event.venue_address].filter(Boolean).join(', ') || null,
  ].filter(Boolean) as string[];

  const list = entries
    .map(({ tent, folderName }) => {
      const num = tent.display_number != null ? `<span class="num">#${tent.display_number}</span> ` : '';
      const cats = (tent.categories ?? []).map((c) => c.name_de).join(', ');
      const catsHtml = cats ? ` <span class="cat">${escapeHtml(cats)}</span>` : '';
      return `<li>${num}<a href="${folderName}/index.html">${escapeHtml(tent.name)}</a>${catsHtml}</li>`;
    })
    .join('');

  const body = `<h1>${escapeHtml(title)}</h1>
<p class="meta">${escapeHtml(metaParts.join('  ·  '))}</p>
<ol class="tents">${list}</ol>`;

  return htmlDoc('de', title, body);
}

export interface ExportProgress {
  done: number;
  total: number;
}

export interface ExportResult {
  blob: Blob;
  tentCount: number;
  photoCount: number;
  /** Files we failed to fetch (path within the zip); surfaced, never silent. */
  skipped: string[];
}

/**
 * Fetch the event's stands + photos and assemble the ZIP in memory. Photos are
 * downloaded at original resolution (no Supabase transform). A photo that fails
 * to download is skipped and reported in `result.skipped` rather than aborting
 * the whole export.
 */
export async function buildEventZip(
  event: Event,
  opts: { onProgress?: (p: ExportProgress) => void } = {},
): Promise<ExportResult> {
  const { data, error } = await supabase
    .from('tents')
    .select('*, tent_categories(category:categories(*))')
    .eq('event_id', event.id)
    .order('display_number', { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  const tents = flattenTentCategories((data ?? []) as never);

  // Pull each stand's photo list up front so we know the total for progress.
  const perTent = await Promise.all(
    tents.map(async (tent) => {
      const { data: photos } = await supabase
        .from('tent_photos')
        .select('storage_path,display_order')
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
  const entries: Array<{ tent: ExportTent; folderName: string }> = [];

  for (const { tent, photos } of perTent) {
    const folderName = tentFolderName(tent);
    entries.push({ tent, folderName });
    const folder = zip.folder(folderName)!;
    const photoFiles: string[] = [];

    for (let i = 0; i < photos.length; i++) {
      const storagePath = photos[i]!.storage_path;
      const fileName = photoFileName(tent, i, extFromStoragePath(storagePath));
      try {
        const res = await fetch(photoPublicUrl(storagePath));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        folder.file(fileName, await res.blob());
        photoFiles.push(fileName);
      } catch {
        skipped.push(`${folderName}/${fileName}`);
      } finally {
        done++;
        opts.onProgress?.({ done, total });
      }
    }

    folder.file('index.html', renderTentPageHtml(tent, event, photoFiles));
  }

  zip.file('index.html', renderOverviewHtml(event, entries));
  const blob = await zip.generateAsync({ type: 'blob' });
  return { blob, tentCount: tents.length, photoCount: total, skipped };
}

/** Trigger a browser download for a generated blob (same pattern as Excel export). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
