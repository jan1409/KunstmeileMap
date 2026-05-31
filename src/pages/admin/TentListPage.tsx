import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase, type Tent } from '../../lib/supabase';
import { useEvent } from '../../hooks/useEvent';
import { useEventPermissions } from '../../hooks/useEventPermissions';
import { exportTentsToBlob } from '../../lib/excel';
import { flattenTentCategories } from '../../lib/tentCategories';
import { useToast } from '../../components/ToastProvider';

export default function TentListPage() {
  const { t } = useTranslation();
  const { eventSlug } = useParams();
  const { event } = useEvent(eventSlug);
  const perms = useEventPermissions(event?.id);
  const [tents, setTents] = useState<Tent[]>([]);
  const [exportBusy, setExportBusy] = useState(false);
  const { showError } = useToast();

  async function handleExport() {
    if (!event) return;
    setExportBusy(true);
    try {
      const { data, error } = await supabase
        .from('tents')
        .select('*, tent_categories(category:categories(*))')
        .eq('event_id', event.id)
        .order('display_number', { ascending: true, nullsFirst: false });
      if (error) throw new Error(error.message);
      const tentsWithCategories = flattenTentCategories((data ?? []) as never);
      const blob = exportTentsToBlob(tentsWithCategories);
      const today = new Date();
      const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const filename = `kunstmeile-${event.slug}-tents-${stamp}.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'export failed';
      showError(`Export failed: ${msg}`);
    } finally {
      setExportBusy(false);
    }
  }

  useEffect(() => {
    if (!event) return;
    let cancelled = false;
    supabase
      .from('tents')
      .select('*')
      .eq('event_id', event.id)
      .order('display_number', { ascending: true, nullsFirst: false })
      .then(({ data }) => {
        if (cancelled) return;
        setTents(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [event]);

  if (!event) return <p>…</p>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {t('admin.tent_list.heading', { title: event.title_de })}
        </h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={exportBusy}
            className="rounded bg-white/10 px-3 py-1 text-sm disabled:opacity-50"
          >
            {t('admin.tent_list.export_xlsx')}
          </button>
          {perms.canEdit && (
            <>
              <Link
                to={`/admin/events/${event.slug}/tents/import`}
                className="rounded bg-white/10 px-3 py-1 text-sm"
              >
                {t('admin.tent_list.csv_import')}
              </Link>
              <Link
                to={`/admin/events/${event.slug}/tents/new`}
                className="rounded bg-white/20 px-3 py-1 text-sm"
              >
                {t('admin.tent_list.new_tent')}
              </Link>
            </>
          )}
        </div>
      </div>
      <table className="w-full text-left text-sm">
        <thead className="border-b border-white/10 text-xs text-white/60">
          <tr>
            <th className="py-2">{t('admin.tent_list.col_number')}</th>
            <th>{t('admin.tent_list.col_name')}</th>
            <th>{t('admin.tent_list.col_slug')}</th>
            <th>{t('admin.tent_list.col_position')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {tents.map((tent) => (
            <tr key={tent.id} className="border-b border-white/5">
              <td className="py-2 font-mono text-xs">{tent.display_number ?? '—'}</td>
              <td>{tent.name}</td>
              <td className="font-mono text-xs">{tent.slug}</td>
              <td className="font-mono text-xs">
                {tent.lat != null && tent.lng != null
                  ? `${tent.lat.toFixed(5)}, ${tent.lng.toFixed(5)}`
                  : '—'}
              </td>
              <td className="space-x-3">
                <Link
                  to={`/admin/events/${event.slug}/tents/${tent.id}`}
                  className="underline"
                >
                  {t('admin.tent_list.action_edit')}
                </Link>
                <Link
                  to={`/${event.slug}/tent/${tent.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {t('admin.tent_list.action_view')}
                </Link>
              </td>
            </tr>
          ))}
          {tents.length === 0 && (
            <tr>
              <td colSpan={5} className="py-4 text-center text-white/50">
                {t('admin.tent_list.empty')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
