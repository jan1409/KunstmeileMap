import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase, type Event } from '../../lib/supabase';
import { DuplicateEventModal } from '../../components/DuplicateEventModal';

export default function EventListPage() {
  const { t } = useTranslation();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [dup, setDup] = useState<Event | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('events')
      .select('*')
      .order('year', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return;
        setEvents(data ?? []);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('admin.event_list.heading')}</h1>
        <Link
          to="/admin/events/new"
          className="rounded bg-white/20 px-3 py-1 text-sm"
        >
          {t('admin.event_list.new_event')}
        </Link>
      </div>
      {loading ? (
        <p>…</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 text-xs text-white/60">
            <tr>
              <th className="py-2">{t('admin.event_list.col_slug')}</th>
              <th>{t('admin.event_list.col_title')}</th>
              <th>{t('admin.event_list.col_year')}</th>
              <th>{t('admin.event_list.col_status')}</th>
              <th>{t('admin.event_list.col_featured')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-b border-white/5">
                <td className="py-2 font-mono text-xs">{e.slug}</td>
                <td>{e.title_de}</td>
                <td>{e.year}</td>
                <td>{e.status}</td>
                <td>{e.is_featured ? '⭐' : ''}</td>
                <td className="space-x-3">
                  <Link
                    to={`/admin/events/${e.slug}/tents`}
                    className="underline"
                  >
                    {t('admin.event_list.action_manage')}
                  </Link>
                  <Link
                    to={`/admin/events/${e.slug}/categories`}
                    className="underline"
                  >
                    {t('admin.event_list.action_categories')}
                  </Link>
                  <Link
                    to={`/admin/events/${e.slug}/settings`}
                    className="underline"
                  >
                    {t('admin.event_list.action_settings')}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setDup(e)}
                    className="underline"
                  >
                    {t('admin.event_list.action_duplicate')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {dup && (
        <DuplicateEventModal
          source={dup}
          onClose={() => setDup(null)}
          onCreated={() => setReloadTick((n) => n + 1)}
        />
      )}
    </div>
  );
}
