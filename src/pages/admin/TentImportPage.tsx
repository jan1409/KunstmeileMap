import Papa from 'papaparse';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useEvent } from '../../hooks/useEvent';
import { useCategories } from '../../hooks/useCategories';

interface CsvRow {
  slug: string;
  name: string;
  display_number?: string;
  category_slugs?: string;
  description_de?: string;
  description_en?: string;
  address?: string;
  website_url?: string;
  instagram_url?: string;
  facebook_url?: string;
  x: string;
  y: string;
  z: string;
}

export default function TentImportPage() {
  const { eventSlug } = useParams();
  const { event } = useEvent(eventSlug);
  const { categories } = useCategories(event?.id);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => setRows(res.data),
    });
  }

  async function importAll() {
    if (!event) return;
    setBusy(true);
    setLog([]);
    for (const r of rows) {
      const slugList = (r.category_slugs ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const matched: Array<{ slug: string; id: string }> = [];
      const missing: string[] = [];
      for (const slug of slugList) {
        const cat = categories.find((c) => c.slug === slug);
        if (cat) matched.push({ slug, id: cat.id });
        else missing.push(slug);
      }
      const displayNumberRaw = r.display_number?.trim()
        ? Number.parseInt(r.display_number, 10)
        : null;
      const displayNumber =
        displayNumberRaw !== null && Number.isFinite(displayNumberRaw)
          ? displayNumberRaw
          : null;

      const { data: inserted, error: tentErr } = await supabase
        .from('tents')
        .insert({
          event_id: event.id,
          slug: r.slug,
          name: r.name,
          description_de: r.description_de || null,
          description_en: r.description_en || null,
          address: r.address || null,
          website_url: r.website_url || null,
          instagram_url: r.instagram_url || null,
          facebook_url: r.facebook_url || null,
          display_number: displayNumber,
          position: { x: Number(r.x), y: Number(r.y), z: Number(r.z) },
        })
        .select('id')
        .single();

      if (tentErr || !inserted) {
        setLog((prev) => [...prev, `❌ ${r.slug}: ${tentErr?.message ?? 'no row returned'}`]);
        continue;
      }

      if (matched.length > 0) {
        const { error: joinErr } = await supabase
          .from('tent_categories')
          .insert(matched.map((m) => ({ tent_id: inserted.id, category_id: m.id })));
        if (joinErr) {
          setLog((prev) => [
            ...prev,
            `⚠️ ${r.slug}: tent inserted but category link failed: ${joinErr.message}`,
          ]);
          continue;
        }
      }
      const missingNote =
        missing.length > 0 ? ` (unknown categories skipped: ${missing.join(',')})` : '';
      setLog((prev) => [...prev, `✓ ${r.slug}${missingNote}`]);
    }
    setBusy(false);
  }

  return (
    <div>
      <h1 className="mb-3 text-2xl font-semibold">CSV import</h1>
      <p className="mb-2 text-sm text-white/60">
        Expected columns:{' '}
        <code className="font-mono text-xs">
          slug, name, display_number, category_slugs, description_de, description_en, address, website_url, instagram_url, facebook_url, x, y, z
        </code>
      </p>
      <label className="block text-xs">
        <span className="block text-white/60">CSV file</span>
        <input type="file" accept=".csv" onChange={onFile} className="mt-1" />
      </label>
      {rows.length > 0 && (
        <>
          <p className="mt-2 text-sm">{rows.length} rows parsed.</p>
          <button
            type="button"
            onClick={importAll}
            disabled={busy}
            className="mt-2 rounded bg-white/20 px-3 py-1 disabled:opacity-50"
          >
            {busy ? '…' : 'Import all'}
          </button>
        </>
      )}
      {log.length > 0 && (
        <pre className="mt-3 max-h-64 overflow-auto rounded bg-black/40 p-2 text-xs">
          {log.join('\n')}
        </pre>
      )}
      <Link
        to={`/admin/events/${eventSlug}/tents`}
        className="mt-3 block text-sm underline"
      >
        Back to tent list
      </Link>
    </div>
  );
}
