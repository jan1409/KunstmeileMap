import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, type Category } from '../lib/supabase';
import { useFocusTrap } from '../hooks/useFocusTrap';
import {
  parseCategoriesFromBlob,
  type ParsedCategoryRow,
} from '../lib/excel';
import { useToast } from './ToastProvider';

interface Props {
  eventId: string;
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

type RowStatus = 'new' | 'update' | 'error';

interface PreviewRow extends ParsedCategoryRow {
  status: RowStatus;
}

export function CategoryImportModal({
  eventId,
  open,
  onClose,
  onImported,
}: Props) {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const trapRef = useFocusTrap<HTMLDivElement>(open);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [existing, setExisting] = useState<Category[]>([]);
  const [parsed, setParsed] = useState<PreviewRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);

  // Fetch existing categories so we can classify rows as new vs. update.
  useEffect(() => {
    if (!open || !eventId) return;
    let cancelled = false;
    supabase
      .from('categories')
      .select('*')
      .eq('event_id', eventId)
      .then(({ data }) => {
        if (cancelled) return;
        setExisting(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [open, eventId]);

  // Reset state every time the modal closes so re-opening starts fresh.
  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronising modal state with the `open` prop; not derived from render input. Resets parsed preview, parse-error, and committing flags on close.
      setParsed(null);
      setParseError(null);
      setCommitting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [open]);

  if (!open) return null;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setParsed(null);
    const result = await parseCategoriesFromBlob(file);
    if (result.fatalError) {
      setParseError(
        t('admin.category.import_fatal_error', { message: result.fatalError }),
      );
      return;
    }
    if (result.rows.length === 0) {
      setParseError(t('admin.category.import_empty'));
      return;
    }
    const existingSlugs = new Set(existing.map((c) => c.slug));
    const previews: PreviewRow[] = result.rows.map((r) => {
      let status: RowStatus;
      if (r.errors.length > 0) status = 'error';
      else if (existingSlugs.has(r.slug)) status = 'update';
      else status = 'new';
      return { ...r, status };
    });
    setParsed(previews);
  }

  function statusLabel(status: RowStatus): string {
    if (status === 'new') return t('admin.category.import_status_new');
    if (status === 'update') return t('admin.category.import_status_update');
    return t('admin.category.import_status_error');
  }

  async function commit() {
    if (!parsed) return;
    const valid = parsed.filter((r) => r.status !== 'error');
    if (valid.length === 0) return;
    setCommitting(true);

    const inserted = valid.filter((r) => r.status === 'new').length;
    const updated = valid.filter((r) => r.status === 'update').length;

    const payload = valid.map((r) => ({
      event_id: eventId,
      slug: r.slug,
      name_de: r.name_de,
      name_en: r.name_en,
      icon: r.icon,
      display_order: r.display_order,
    }));

    const { error } = await supabase
      .from('categories')
      .upsert(payload, { onConflict: 'event_id,slug' });

    setCommitting(false);

    if (error) {
      showError(t('admin.category.import_error', { message: error.message }));
      return;
    }

    showSuccess(t('admin.category.import_success', { inserted, updated }));
    onImported();
    onClose();
  }

  const hasValidRows =
    parsed !== null && parsed.some((r) => r.status !== 'error');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="category-import-title"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4"
    >
      <div
        ref={trapRef}
        className="w-full max-w-2xl rounded bg-neutral-900 p-6"
      >
        <h2
          id="category-import-title"
          className="mb-4 text-lg font-semibold"
        >
          {t('admin.category.import_modal_heading')}
        </h2>

        <label className="block text-xs">
          <span className="block text-white/60">
            {t('admin.category.import_pick_file')}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.csv"
            onChange={onFile}
            className="mt-1"
          />
        </label>

        {parseError && (
          <p role="alert" className="mt-2 text-sm text-red-300">
            {parseError}
          </p>
        )}

        {parsed && parsed.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-medium">
              {t('admin.category.import_preview_heading')}
            </h3>
            <div className="max-h-80 overflow-auto rounded border border-white/10">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/5 text-white/70">
                  <tr>
                    <th className="px-2 py-1">#</th>
                    <th className="px-2 py-1">
                      {t('admin.category.import_col_status')}
                    </th>
                    <th className="px-2 py-1">
                      {t('admin.category.slug_label')}
                    </th>
                    <th className="px-2 py-1">
                      {t('admin.category.name_de_label')}
                    </th>
                    <th className="px-2 py-1">
                      {t('admin.category.name_en_label')}
                    </th>
                    <th className="px-2 py-1">
                      {t('admin.category.icon_label')}
                    </th>
                    <th className="px-2 py-1">
                      {t('admin.category.order_label')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((row) => (
                    <tr
                      key={row.rowNumber}
                      className="border-t border-white/5"
                    >
                      <td className="px-2 py-1 text-white/50">
                        {row.rowNumber}
                      </td>
                      <td className="px-2 py-1">
                        <span
                          className={
                            row.status === 'error'
                              ? 'text-red-400'
                              : row.status === 'update'
                                ? 'text-yellow-300'
                                : 'text-green-300'
                          }
                        >
                          {statusLabel(row.status)}
                        </span>
                        {row.status === 'error' && row.errors.length > 0 && (
                          <span className="ml-1 text-white/60">
                            ({row.errors.join(', ')})
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1 font-mono">{row.slug}</td>
                      <td className="px-2 py-1">{row.name_de}</td>
                      <td className="px-2 py-1">{row.name_en ?? ''}</td>
                      <td className="px-2 py-1">{row.icon}</td>
                      <td className="px-2 py-1">{row.display_order}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-white/10 px-3 py-1"
          >
            {t('admin.category.cancel')}
          </button>
          <button
            type="button"
            onClick={commit}
            disabled={!hasValidRows || committing}
            className="rounded bg-white/20 px-3 py-1 disabled:opacity-50"
          >
            {committing
              ? t('admin.category.import_submitting')
              : t('admin.category.import_submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
