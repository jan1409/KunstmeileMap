import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase, type Category } from '../../lib/supabase';
import { useEvent } from '../../hooks/useEvent';
import { CATEGORY_PALETTE, colorForSlug } from '../../lib/map';
import { exportCategoriesToBlob } from '../../lib/excel';
import { useToast } from '../../components/ToastProvider';
import { CategoryImportModal } from '../../components/CategoryImportModal';

export default function CategoryListPage() {
  const { t } = useTranslation();
  const { eventSlug } = useParams();
  const { event } = useEvent(eventSlug);
  const [categories, setCategories] = useState<Category[]>([]);
  const [reloadTick, setReloadTick] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const { showError } = useToast();
  const [draft, setDraft] = useState({
    slug: '',
    name_de: '',
    name_en: '',
    icon: '',
    color: '',
    display_order: 0,
  });

  useEffect(() => {
    if (!event) return;
    let cancelled = false;
    supabase
      .from('categories')
      .select('*')
      .eq('event_id', event.id)
      .order('display_order', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return;
        setCategories(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [event, reloadTick]);

  function resetDraft() {
    setDraft({
      slug: '',
      name_de: '',
      name_en: '',
      icon: '',
      color: '',
      display_order: 0,
    });
  }

  function openCreate() {
    setEditingId(null);
    setConfirmingId(null);
    setDraft({
      slug: '',
      name_de: '',
      name_en: '',
      icon: '',
      color: '',
      display_order: categories.length,
    });
    setShowForm(true);
  }

  function openEdit(c: Category) {
    setEditingId(c.id);
    setConfirmingId(null);
    setDraft({
      slug: c.slug,
      name_de: c.name_de,
      name_en: c.name_en ?? '',
      icon: c.icon ?? '',
      color: c.color ?? '',
      display_order: c.display_order,
    });
    setShowForm(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!event) return;
    const payload = {
      slug: draft.slug,
      name_de: draft.name_de,
      name_en: draft.name_en,
      icon: draft.icon || '✨',
      color: draft.color || null,
      display_order: draft.display_order,
    };
    if (editingId === null) {
      const { error } = await supabase
        .from('categories')
        .insert({ event_id: event.id, ...payload });
      if (error) {
        showError(t('admin.category.save_error', { message: error.message }));
        return;
      }
    } else {
      const { error } = await supabase
        .from('categories')
        .update(payload)
        .eq('id', editingId);
      if (error) {
        showError(t('admin.category.save_error', { message: error.message }));
        return;
      }
    }
    resetDraft();
    setEditingId(null);
    setShowForm(false);
    setReloadTick((n) => n + 1);
  }

  async function confirmDelete(id: string) {
    await supabase.from('categories').delete().eq('id', id);
    setConfirmingId(null);
    // If the user was editing the row they just deleted, drop the form.
    if (editingId === id) {
      setEditingId(null);
      setShowForm(false);
      resetDraft();
    }
    setReloadTick((n) => n + 1);
  }

  function handleExport() {
    if (!event) return;
    setExportBusy(true);
    try {
      const blob = exportCategoriesToBlob(categories);
      const today = new Date();
      const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const filename = `kunstmeile-${event.slug}-categories-${stamp}.xlsx`;
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

  if (!event) return null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {t('admin.category.heading', { title: event.title_de })}
        </h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowImport(true)}
            className="rounded bg-white/10 px-3 py-1 text-sm"
          >
            {t('admin.category.import')}
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exportBusy || categories.length === 0}
            className="rounded bg-white/10 px-3 py-1 text-sm disabled:opacity-50"
          >
            {t('admin.category.export_xlsx')}
          </button>
          {!showForm && (
            <button
              type="button"
              onClick={openCreate}
              className="rounded bg-white/20 px-3 py-1 text-sm"
            >
              {t('admin.category.new')}
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={onSubmit}
          className="mb-4 grid grid-cols-1 gap-3 rounded border border-white/10 p-3 sm:grid-cols-6"
        >
          <label className="block text-xs">
            <span className="block text-white/60">{t('admin.category.slug_label')}</span>
            <input
              required
              pattern="[a-z0-9-]+"
              value={draft.slug}
              onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
              className="input mt-1"
            />
          </label>
          <label className="block text-xs">
            <span className="block text-white/60">{t('admin.category.order_label')}</span>
            <input
              type="number"
              min="0"
              value={draft.display_order}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  display_order: Number.parseInt(e.target.value, 10) || 0,
                })
              }
              className="input mt-1"
            />
          </label>
          <label className="block text-xs">
            <span className="block text-white/60">{t('admin.category.name_de_label')}</span>
            <input
              required
              value={draft.name_de}
              onChange={(e) => setDraft({ ...draft, name_de: e.target.value })}
              className="input mt-1"
            />
          </label>
          <label className="block text-xs">
            <span className="block text-white/60">{t('admin.category.name_en_label')}</span>
            <input
              value={draft.name_en}
              onChange={(e) => setDraft({ ...draft, name_en: e.target.value })}
              className="input mt-1"
            />
          </label>
          <label className="block text-xs">
            <span className="block text-white/60">{t('admin.category.icon_label')}</span>
            <input
              value={draft.icon}
              placeholder="✨"
              onChange={(e) => setDraft({ ...draft, icon: e.target.value })}
              className="input mt-1"
            />
          </label>
          <div className="block text-xs">
            <span className="block text-white/60">
              {t('admin.category.color_label')}
            </span>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                aria-label={t('admin.category.color_label')}
                value={draft.color || colorForSlug(draft.slug || 'x')}
                onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                className="h-8 w-10 cursor-pointer rounded border border-white/10 bg-transparent p-0"
              />
              <button
                type="button"
                onClick={() => setDraft({ ...draft, color: '' })}
                disabled={draft.color === ''}
                className="rounded bg-white/10 px-2 py-1 text-xs disabled:opacity-40"
              >
                {t('admin.category.color_auto')}
              </button>
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {CATEGORY_PALETTE.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  aria-label={hex}
                  title={hex}
                  onClick={() => setDraft({ ...draft, color: hex })}
                  style={{ backgroundColor: hex }}
                  className={`h-5 w-5 rounded border ${
                    draft.color.toLowerCase() === hex.toLowerCase()
                      ? 'border-white'
                      : 'border-white/20'
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2 sm:col-span-6">
            <button
              type="submit"
              className="rounded bg-white/20 px-3 py-1 text-sm"
            >
              {t(editingId ? 'admin.category.update' : 'admin.category.save')}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                resetDraft();
              }}
              className="rounded bg-white/10 px-3 py-1 text-sm"
            >
              {t('admin.category.cancel')}
            </button>
          </div>
        </form>
      )}

      <table className="w-full text-left text-sm">
        <thead className="border-b border-white/10 text-xs text-white/60">
          <tr>
            <th className="py-2">{t('admin.category.col_order')}</th>
            <th>{t('admin.category.col_icon')}</th>
            <th>{t('admin.category.col_color')}</th>
            <th>{t('admin.category.col_slug')}</th>
            <th>{t('admin.category.col_de')}</th>
            <th>{t('admin.category.col_en')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {categories.map((c) => (
            <tr key={c.id} className="border-b border-white/5">
              <td className="py-2">{c.display_order}</td>
              <td>{c.icon}</td>
              <td>
                <span className="inline-flex items-center gap-1">
                  <span
                    aria-hidden="true"
                    style={{ backgroundColor: c.color ?? colorForSlug(c.slug) }}
                    className="inline-block h-4 w-4 rounded border border-white/20"
                  />
                  {!c.color && (
                    <span className="text-xs text-white/40">
                      {t('admin.category.color_auto')}
                    </span>
                  )}
                </span>
              </td>
              <td className="font-mono text-xs">{c.slug}</td>
              <td>{c.name_de}</td>
              <td>{c.name_en}</td>
              <td>
                {confirmingId === c.id ? (
                  <span className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => confirmDelete(c.id)}
                      className="text-red-400"
                    >
                      {t('admin.category.confirm_delete')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(null)}
                      className="text-white/60"
                    >
                      {t('admin.category.cancel')}
                    </button>
                  </span>
                ) : (
                  <span className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      className="text-white/80"
                    >
                      {t('admin.category.edit')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmingId(c.id);
                        setEditingId(null);
                        setShowForm(false);
                      }}
                      className="text-red-400"
                    >
                      {t('admin.category.delete')}
                    </button>
                  </span>
                )}
              </td>
            </tr>
          ))}
          {categories.length === 0 && (
            <tr>
              <td colSpan={7} className="py-4 text-center text-white/50">
                {t('admin.category.empty')}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <CategoryImportModal
        eventId={event.id}
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={() => setReloadTick((n) => n + 1)}
      />
    </div>
  );
}
