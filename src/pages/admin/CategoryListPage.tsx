import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase, type Category } from '../../lib/supabase';
import { useEvent } from '../../hooks/useEvent';

export default function CategoryListPage() {
  const { eventSlug } = useParams();
  const { event } = useEvent(eventSlug);
  const [categories, setCategories] = useState<Category[]>([]);
  const [reloadTick, setReloadTick] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    slug: '',
    name_de: '',
    name_en: '',
    icon: '',
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
    setDraft({ slug: '', name_de: '', name_en: '', icon: '' });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!event) return;
    await supabase.from('categories').insert({
      event_id: event.id,
      slug: draft.slug,
      name_de: draft.name_de,
      name_en: draft.name_en,
      icon: draft.icon || '✨',
      display_order: categories.length,
    });
    resetDraft();
    setShowForm(false);
    setReloadTick((n) => n + 1);
  }

  async function confirmDelete(id: string) {
    await supabase.from('categories').delete().eq('id', id);
    setConfirmingId(null);
    setReloadTick((n) => n + 1);
  }

  if (!event) return null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Categories — {event.title_de}
        </h1>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded bg-white/20 px-3 py-1 text-sm"
          >
            + New category
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={onSubmit}
          className="mb-4 grid grid-cols-1 gap-3 rounded border border-white/10 p-3 sm:grid-cols-4"
        >
          <label className="block text-xs">
            <span className="block text-white/60">Slug</span>
            <input
              required
              pattern="[a-z0-9-]+"
              value={draft.slug}
              onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
              className="input mt-1"
            />
          </label>
          <label className="block text-xs">
            <span className="block text-white/60">Name (DE)</span>
            <input
              required
              value={draft.name_de}
              onChange={(e) => setDraft({ ...draft, name_de: e.target.value })}
              className="input mt-1"
            />
          </label>
          <label className="block text-xs">
            <span className="block text-white/60">Name (EN)</span>
            <input
              value={draft.name_en}
              onChange={(e) => setDraft({ ...draft, name_en: e.target.value })}
              className="input mt-1"
            />
          </label>
          <label className="block text-xs">
            <span className="block text-white/60">Icon</span>
            <input
              value={draft.icon}
              placeholder="✨"
              onChange={(e) => setDraft({ ...draft, icon: e.target.value })}
              className="input mt-1"
            />
          </label>
          <div className="flex gap-2 sm:col-span-4">
            <button
              type="submit"
              className="rounded bg-white/20 px-3 py-1 text-sm"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetDraft();
              }}
              className="rounded bg-white/10 px-3 py-1 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <table className="w-full text-left text-sm">
        <thead className="border-b border-white/10 text-xs text-white/60">
          <tr>
            <th className="py-2">Order</th>
            <th>Icon</th>
            <th>Slug</th>
            <th>DE</th>
            <th>EN</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {categories.map((c) => (
            <tr key={c.id} className="border-b border-white/5">
              <td className="py-2">{c.display_order}</td>
              <td>{c.icon}</td>
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
                      Confirm delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(null)}
                      className="text-white/60"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingId(c.id)}
                    className="text-red-400"
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
          {categories.length === 0 && (
            <tr>
              <td colSpan={6} className="py-4 text-center text-white/50">
                No categories yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
