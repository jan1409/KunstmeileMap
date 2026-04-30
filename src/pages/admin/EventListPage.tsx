import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, type Event } from '../../lib/supabase';

export default function EventListPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

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
  }, []);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Events</h1>
        <Link
          to="/admin/events/new"
          className="rounded bg-white/20 px-3 py-1 text-sm"
        >
          + New event
        </Link>
      </div>
      {loading ? (
        <p>…</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 text-xs text-white/60">
            <tr>
              <th className="py-2">Slug</th>
              <th>Title</th>
              <th>Year</th>
              <th>Status</th>
              <th>Featured</th>
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
                    Manage
                  </Link>
                  <Link
                    to={`/admin/events/${e.slug}/categories`}
                    className="underline"
                  >
                    Categories
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
