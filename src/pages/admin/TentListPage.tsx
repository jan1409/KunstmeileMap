import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase, type Tent } from '../../lib/supabase';
import { useEvent } from '../../hooks/useEvent';

export default function TentListPage() {
  const { eventSlug } = useParams();
  const { event } = useEvent(eventSlug);
  const [tents, setTents] = useState<Tent[]>([]);

  useEffect(() => {
    if (!event) return;
    let cancelled = false;
    supabase
      .from('tents')
      .select('*')
      .eq('event_id', event.id)
      .order('name')
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
        <h1 className="text-2xl font-semibold">{event.title_de} — Tents</h1>
        <div className="flex gap-2">
          <Link
            to={`/admin/events/${event.slug}/tents/import`}
            className="rounded bg-white/10 px-3 py-1 text-sm"
          >
            CSV import
          </Link>
          <Link
            to={`/admin/events/${event.slug}/tents/new`}
            className="rounded bg-white/20 px-3 py-1 text-sm"
          >
            + New tent
          </Link>
        </div>
      </div>
      <table className="w-full text-left text-sm">
        <thead className="border-b border-white/10 text-xs text-white/60">
          <tr>
            <th className="py-2">Name</th>
            <th>Slug</th>
            <th>Position</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {tents.map((t) => (
            <tr key={t.id} className="border-b border-white/5">
              <td className="py-2">{t.name}</td>
              <td className="font-mono text-xs">{t.slug}</td>
              <td className="font-mono text-xs">{JSON.stringify(t.position)}</td>
              <td className="space-x-3">
                <Link
                  to={`/admin/events/${event.slug}/tents/${t.id}`}
                  className="underline"
                >
                  Edit
                </Link>
                <Link
                  to={`/${event.slug}/tent/${t.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  View 3D
                </Link>
              </td>
            </tr>
          ))}
          {tents.length === 0 && (
            <tr>
              <td colSpan={4} className="py-4 text-center text-white/50">
                No tents yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
