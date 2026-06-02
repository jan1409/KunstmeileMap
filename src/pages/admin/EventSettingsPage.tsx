import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useEvent } from '../../hooks/useEvent';
import {
  buildEventZip,
  downloadBlob,
  type ExportProgress,
} from '../../lib/exportEvent';

type Status = 'draft' | 'published' | 'archived';

export default function EventSettingsPage() {
  const { eventSlug } = useParams();
  const { event } = useEvent(eventSlug);
  const { t } = useTranslation();
  const [titleDe, setTitleDe] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [status, setStatus] = useState<Status>('draft');
  const [isFeatured, setIsFeatured] = useState(false);
  const [defaultLat, setDefaultLat] = useState<number>(49.0);
  const [defaultLng, setDefaultLng] = useState<number>(8.4);
  const [defaultZoom, setDefaultZoom] = useState<number>(17);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportDone, setExportDone] = useState<{ tents: number; photos: number; skipped: number } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleExport() {
    if (!event) return;
    setExporting(true);
    setExportProgress({ done: 0, total: 0 });
    setExportDone(null);
    setExportError(null);
    try {
      const result = await buildEventZip(event, { onProgress: setExportProgress });
      const today = new Date();
      const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      downloadBlob(result.blob, `kunstmeile-${event.slug}-export-${stamp}.zip`);
      setExportDone({
        tents: result.tentCount,
        photos: result.photoCount,
        skipped: result.skipped.length,
      });
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'export failed');
    } finally {
      setExporting(false);
      setExportProgress(null);
    }
  }

  useEffect(() => {
    if (!event) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seeds form state once when the loaded event arrives; subsequent edits are local. React 19's preferred alternative (re-mount via key) would also force-discard in-flight edits on re-fetch, so it's a worse fit here.
    setTitleDe(event.title_de);
    setTitleEn(event.title_en ?? '');
    setStatus(event.status as Status);
    setIsFeatured(event.is_featured);
    setDefaultLat(event.default_lat);
    setDefaultLng(event.default_lng);
    setDefaultZoom(event.default_zoom);
  }, [event]);

  async function save() {
    if (!event) return;
    setBusy(true);
    setError(null);
    setSavedAt(null);
    const { error: err } = await supabase
      .from('events')
      .update({
        title_de: titleDe,
        title_en: titleEn || null,
        status,
        is_featured: isFeatured,
        default_lat: defaultLat,
        default_lng: defaultLng,
        default_zoom: defaultZoom,
      })
      .eq('id', event.id);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSavedAt(Date.now());
  }

  if (!event) return null;

  return (
    <div className="max-w-xl space-y-3">
      <h1 className="text-2xl font-semibold">
        {t('admin.event_settings.heading', { title: event.title_de })}
      </h1>

      <label className="block text-xs">
        <span className="block text-white/60">{t('admin.event_settings.title_de_label')}</span>
        <input
          value={titleDe}
          onChange={(e) => setTitleDe(e.target.value)}
          className="input mt-1"
        />
      </label>

      <label className="block text-xs">
        <span className="block text-white/60">{t('admin.event_settings.title_en_label')}</span>
        <input
          value={titleEn}
          onChange={(e) => setTitleEn(e.target.value)}
          className="input mt-1"
        />
      </label>

      <label className="block text-xs">
        <span className="block text-white/60">{t('admin.event_settings.status_label')}</span>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as Status)}
          className="input mt-1"
        >
          <option value="draft">{t('admin.event_settings.status_draft')}</option>
          <option value="published">{t('admin.event_settings.status_published')}</option>
          <option value="archived">{t('admin.event_settings.status_archived')}</option>
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isFeatured}
          onChange={(e) => setIsFeatured(e.target.checked)}
        />
        {t('admin.event_settings.is_featured_label')}
      </label>

      <label className="block text-xs">
        <span className="block text-white/60">{t('admin.event.default_lat_label')}</span>
        <input
          type="number"
          step="any"
          value={defaultLat}
          onChange={(e) => {
            const v = e.target.value === '' ? null : Number(e.target.value);
            if (v === null || Number.isNaN(v)) return;
            setDefaultLat(v);
          }}
          className="input mt-1"
        />
      </label>

      <label className="block text-xs">
        <span className="block text-white/60">{t('admin.event.default_lng_label')}</span>
        <input
          type="number"
          step="any"
          value={defaultLng}
          onChange={(e) => {
            const v = e.target.value === '' ? null : Number(e.target.value);
            if (v === null || Number.isNaN(v)) return;
            setDefaultLng(v);
          }}
          className="input mt-1"
        />
      </label>

      <label className="block text-xs">
        <span className="block text-white/60">{t('admin.event.default_zoom_label')}</span>
        <input
          type="number"
          min={1}
          max={19}
          value={defaultZoom}
          onChange={(e) => {
            const v = e.target.value === '' ? null : Number(e.target.value);
            if (v === null || Number.isNaN(v)) return;
            setDefaultZoom(v);
          }}
          className="input mt-1"
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded bg-white/20 px-4 py-2 disabled:opacity-50"
        >
          {busy ? t('admin.event_settings.saving') : t('admin.event_settings.save_button')}
        </button>
        {savedAt && !error && (
          <span className="text-xs text-green-400">{t('admin.event_settings.saved_flash')}</span>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}

      <section className="mt-6 border-t border-white/10 pt-4">
        <h2 className="text-lg font-semibold">{t('admin.event_settings.export_heading')}</h2>
        <p className="mt-1 text-xs text-white/60">{t('admin.event_settings.export_help')}</p>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="rounded bg-white/20 px-4 py-2 text-sm disabled:opacity-50"
          >
            {exporting
              ? t('admin.event_settings.exporting', {
                  done: exportProgress?.done ?? 0,
                  total: exportProgress?.total ?? 0,
                })
              : t('admin.event_settings.export_button')}
          </button>
          {exportDone && (
            <span className="text-xs text-green-400">
              {t('admin.event_settings.export_done', {
                tents: exportDone.tents,
                photos: exportDone.photos,
              })}
            </span>
          )}
        </div>
        {exportDone && exportDone.skipped > 0 && (
          <p className="mt-2 text-xs text-amber-400">
            {t('admin.event_settings.export_skipped', { count: exportDone.skipped })}
          </p>
        )}
        {exportError && (
          <p role="alert" className="mt-2 text-xs text-red-400">
            {t('admin.event_settings.export_error', { message: exportError })}
          </p>
        )}
      </section>
    </div>
  );
}
