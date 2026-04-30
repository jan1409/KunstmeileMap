import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase, type Tent } from '../../lib/supabase';
import { useEvent } from '../../hooks/useEvent';
import { useCategories } from '../../hooks/useCategories';
import { SplatViewer } from '../../components/SplatViewer';
import {
  TentEditForm,
  type TentFormValues,
} from '../../components/TentEditForm';

type Position = { x: number; y: number; z: number };

export default function TentEditPage() {
  const { eventSlug, tentId } = useParams();
  const navigate = useNavigate();
  const { event } = useEvent(eventSlug);
  const { categories } = useCategories(event?.id);
  const [tent, setTent] = useState<Tent | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [placeMode, setPlaceMode] = useState(false);
  const [hoverPoint, setHoverPoint] = useState<Position | null>(null);

  // Load existing tent if editing (path is .../tents/<uuid> rather than /new).
  useEffect(() => {
    if (!tentId || tentId === 'new') return;
    let cancelled = false;
    supabase
      .from('tents')
      .select('*')
      .eq('id', tentId)
      .single()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setTent(data);
        setPosition(data.position as unknown as Position);
      });
    return () => {
      cancelled = true;
    };
  }, [tentId]);

  // ESC cancels in-progress placement.
  useEffect(() => {
    if (!placeMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPlaceMode(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [placeMode]);

  async function onSubmit(values: TentFormValues) {
    if (!event || !position) return;
    const payload = {
      ...values,
      event_id: event.id,
      position,
      category_id: values.category_id || null,
      description_de: values.description_de || null,
      description_en: values.description_en || null,
      address: values.address || null,
      website_url: values.website_url || null,
      instagram_url: values.instagram_url || null,
      facebook_url: values.facebook_url || null,
      email_public: values.email_public || null,
    };
    if (tent) {
      await supabase.from('tents').update(payload).eq('id', tent.id);
    } else {
      await supabase.from('tents').insert(payload);
    }
    navigate(`/admin/events/${event.slug}/tents`);
  }

  if (!event) return null;
  // Edit mode: hold off rendering the form until the tent has loaded so RHF
  // can seed its defaultValues from `initial` on first mount (RHF won't re-read
  // defaultValues if `initial` arrives later).
  const isEditing = tentId && tentId !== 'new';
  if (isEditing && !tent) return <p>…</p>;

  return (
    <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-2">
      <div>
        <h1 className="mb-3 text-xl font-semibold">
          {tent ? `Edit: ${tent.name}` : 'New Tent'}
        </h1>
        <TentEditForm
          initial={tent ?? undefined}
          categories={categories}
          position={position}
          onRequestPlace={() => setPlaceMode(true)}
          onSubmit={onSubmit}
        />
      </div>
      <div className="relative h-[60vh] overflow-hidden rounded lg:h-[80vh]">
        <SplatViewer
          splatUrl={event.splat_url ?? 'https://sparkjs.dev/sample/garden.splat'}
          markers={[]}
          placeMode={placeMode}
          onPlaceHover={setHoverPoint}
          onPlaceClick={(p) => {
            setPosition(p);
            setPlaceMode(false);
          }}
        />
        {placeMode && (
          <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
            <span className="rounded bg-black/70 px-3 py-1 text-xs">
              Click to place{' '}
              {hoverPoint
                ? `(${hoverPoint.x.toFixed(1)}, ${hoverPoint.y.toFixed(1)}, ${hoverPoint.z.toFixed(1)})`
                : '…'}{' '}
              — ESC to cancel
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
