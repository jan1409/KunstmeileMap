import Papa from 'papaparse';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { useEvent } from '../../hooks/useEvent';
import { useCategories } from '../../hooks/useCategories';
import { useTents } from '../../hooks/useTents';
import {
  parserForFilename,
  validateRow,
  type ParsedRow,
  type RawRow,
  type RowResult,
} from '../../lib/excel';

type WizardStep = 'upload' | 'preview' | 'done';

interface PreviewRow {
  index: number;
  raw: RawRow;
  result: RowResult;
}

/**
 * Normalise a cell value coming from PapaParse (always string) or SheetJS
 * (may be number/boolean/Date/string) into the trimmed string that
 * validateRow expects.
 */
function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function normaliseRow(input: Record<string, unknown>): RawRow {
  return {
    name: cellToString(input.name),
    display_number: cellToString(input.display_number),
    slug: cellToString(input.slug),
    category_slugs: cellToString(input.category_slugs),
    description_de: cellToString(input.description_de),
    description_en: cellToString(input.description_en),
    address: cellToString(input.address),
    website_url: cellToString(input.website_url),
    instagram_url: cellToString(input.instagram_url),
    facebook_url: cellToString(input.facebook_url),
    email_public: cellToString(input.email_public),
    lat: cellToString(input.lat),
    lng: cellToString(input.lng),
  };
}

function statusIcon(status: RowResult['status']): string {
  if (status === 'ok') return '✅';
  if (status === 'warning') return '⚠️';
  return '❌';
}

function statusLabelKey(status: RowResult['status']): string {
  if (status === 'ok') return 'admin.import.status_ok';
  if (status === 'warning') return 'admin.import.status_warning';
  return 'admin.import.status_error';
}

export default function TentImportPage() {
  const { eventSlug } = useParams();
  const { t } = useTranslation();
  const { event } = useEvent(eventSlug);
  const { categories, loading: categoriesLoading } = useCategories(event?.id);
  const { tents, loading: tentsLoading } = useTents(event?.id);

  const [step, setStep] = useState<WizardStep>('upload');
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Block the file picker until the validation context (existing tents +
  // categories) has finished loading from Supabase. Otherwise buildPreview
  // would seed validateRow with empty sets, silently passing DB-existing
  // duplicates and flagging all categories as unknown.
  const isReady = !tentsLoading && !categoriesLoading && event != null;

  function buildPreview(rawRows: Record<string, unknown>[]) {
    const knownCategorySlugs = new Set(categories.map((c) => c.slug));
    // Seed collision sets with what already exists in the DB so the import
    // can't introduce duplicates against pre-existing tents either.
    const existingDisplayNumbers = new Set<number>(
      tents
        .map((t) => t.display_number)
        .filter((n): n is number => typeof n === 'number'),
    );
    const existingSlugs = new Set<string>(tents.map((t) => t.slug));

    const results: PreviewRow[] = [];
    rawRows.forEach((rawObj, i) => {
      const raw = normaliseRow(rawObj);
      const result = validateRow(raw, {
        knownCategorySlugs,
        existingDisplayNumbers,
        existingSlugs,
        rowIndex: i + 1,
      });
      // Grow collision sets so subsequent rows detect in-batch duplicates.
      if (result.parsed) {
        existingDisplayNumbers.add(result.parsed.display_number);
        existingSlugs.add(result.parsed.slug);
      }
      results.push({ index: i + 1, raw, result });
    });
    setPreview(results);
    setStep('preview');
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const parser = parserForFilename(file.name);
    if (!parser) {
      setParseError(t('admin.import.error_unsupported_file'));
      return;
    }
    setParseError(null);

    if (parser === 'csv') {
      Papa.parse<Record<string, unknown>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => buildPreview(res.data),
      });
      return;
    }

    // xlsx
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result;
      if (!data) return;
      const wb = XLSX.read(data, { type: 'array' });
      const firstSheetName = wb.SheetNames[0];
      if (!firstSheetName) {
        setParseError(t('admin.import.error_unsupported_file'));
        return;
      }
      const ws = wb.Sheets[firstSheetName];
      if (!ws) {
        setParseError(t('admin.import.error_unsupported_file'));
        return;
      }
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
        defval: '',
      });
      buildPreview(json);
    };
    reader.readAsArrayBuffer(file);
  }

  function reset() {
    setPreview([]);
    setLog([]);
    setParseError(null);
    setStep('upload');
    // Clear the <input type="file"> value so re-picking the same file after
    // going back from preview/done actually fires onChange again (browsers
    // dedupe on identical value).
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function commit() {
    if (!event) return;
    setBusy(true);
    setLog([]);
    const localLog: string[] = [];

    // Per spec: each row is its own request; on per-row failure we log and
    // continue. supabase-js doesn't expose a multi-statement transaction.
    for (const row of preview) {
      if (row.result.status === 'error' || !row.result.parsed) continue;
      const parsed: ParsedRow = row.result.parsed;
      const matched: Array<{ slug: string; id: string }> = [];
      for (const slug of parsed.category_slugs) {
        const cat = categories.find((c) => c.slug === slug);
        if (cat) matched.push({ slug, id: cat.id });
      }

      const { data: inserted, error: tentErr } = await supabase
        .from('tents')
        .insert({
          event_id: event.id,
          slug: parsed.slug,
          name: parsed.name,
          description_de: parsed.description_de,
          description_en: parsed.description_en,
          address: parsed.address,
          website_url: parsed.website_url,
          instagram_url: parsed.instagram_url,
          facebook_url: parsed.facebook_url,
          email_public: parsed.email_public,
          display_number: parsed.display_number,
          lat: parsed.lat,
          lng: parsed.lng,
        })
        .select('id')
        .single();

      if (tentErr || !inserted) {
        localLog.push(
          `❌ ${parsed.slug}: ${tentErr?.message ?? 'no row returned'}`,
        );
        continue;
      }

      if (matched.length > 0) {
        const { error: joinErr } = await supabase
          .from('tent_categories')
          .insert(
            matched.map((m) => ({ tent_id: inserted.id, category_id: m.id })),
          );
        if (joinErr) {
          localLog.push(
            `⚠️ ${parsed.slug}: tent inserted but category link failed: ${joinErr.message}`,
          );
          continue;
        }
      }
      localLog.push(`✓ ${parsed.slug}`);
    }
    setLog(localLog);
    setBusy(false);
    setStep('done');
  }

  const importableCount = preview.filter(
    (r) => r.result.status !== 'error',
  ).length;

  return (
    <div>
      <h1 className="mb-3 text-2xl font-semibold">
        {t('admin.import.heading')}
      </h1>

      {step === 'upload' && (
        <>
          <p className="mb-2 text-sm text-white/60">{t('admin.import.help')}</p>
          <p className="mb-3 text-xs text-white/60">
            <a
              href="/import-template.xlsx"
              className="underline"
              download
            >
              {t('admin.import.download_template')}
            </a>
          </p>
          <label className="block text-xs">
            <span className="block text-white/60">CSV / XLSX</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              onChange={onFile}
              disabled={!isReady}
              className="mt-1 disabled:opacity-50"
            />
            {!isReady && (
              <span className="ml-2 text-white/50">
                {t('admin.import.loading_data')}
              </span>
            )}
          </label>
          {parseError && (
            <p className="mt-2 text-sm text-red-300">{parseError}</p>
          )}
        </>
      )}

      {step === 'preview' && (
        <>
          <h2 className="mb-2 text-lg font-medium">
            {t('admin.import.preview_heading')}
          </h2>
          <div className="overflow-auto rounded border border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/5 text-white/70">
                <tr>
                  <th className="px-2 py-1">#</th>
                  <th className="px-2 py-1">{t('admin.import.col_status')}</th>
                  <th className="px-2 py-1">name</th>
                  <th className="px-2 py-1">display_number</th>
                  <th className="px-2 py-1">notes</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row) => {
                  const notes = [
                    ...(row.result.errors ?? []),
                    ...(row.result.warnings ?? []),
                  ].join(', ');
                  return (
                    <tr key={row.index} className="border-t border-white/5">
                      <td className="px-2 py-1 text-white/50">{row.index}</td>
                      <td className="px-2 py-1">
                        <span
                          role="img"
                          aria-label={t(statusLabelKey(row.result.status))}
                        >
                          {statusIcon(row.result.status)}
                        </span>
                      </td>
                      <td className="px-2 py-1">{row.raw.name}</td>
                      <td className="px-2 py-1">{row.raw.display_number}</td>
                      <td className="px-2 py-1 text-white/70">{notes}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="rounded bg-white/10 px-3 py-1 text-sm"
            >
              {t('common.back')}
            </button>
            <button
              type="button"
              onClick={commit}
              disabled={busy || importableCount === 0}
              className="rounded bg-white/20 px-3 py-1 text-sm disabled:opacity-50"
            >
              {busy
                ? '…'
                : t('admin.import.commit_button', {
                    count: importableCount,
                  })}
            </button>
          </div>
        </>
      )}

      {step === 'done' && (
        <>
          <h2 className="mb-2 text-lg font-medium">
            {t('admin.import.done_heading')}
          </h2>
          <pre className="max-h-64 overflow-auto rounded bg-black/40 p-2 text-xs">
            {log.join('\n')}
          </pre>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="rounded bg-white/10 px-3 py-1 text-sm"
            >
              {t('common.back')}
            </button>
          </div>
        </>
      )}

      <Link
        to={`/admin/events/${eventSlug}/tents`}
        className="mt-4 block text-sm underline"
      >
        {t('admin.import.back_to_list')}
      </Link>
    </div>
  );
}
