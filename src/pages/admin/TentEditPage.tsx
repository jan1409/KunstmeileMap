import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase, type Tent } from '../../lib/supabase';
import { useEvent } from '../../hooks/useEvent';
import { useCategories } from '../../hooks/useCategories';
import { SplatViewer } from '../../components/SplatViewer';
import { PhotoUploadZone } from '../../components/PhotoUploadZone';
import { useToast } from '../../components/ToastProvider';
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
  const { showError } = useToast();
  const [tent, setTent] = useState<Tent | null>(null);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [position, setPosition] = useState<Position | null>(null);
  const [placeMode, setPlaceMode] = useState(false);
  const [hoverPoint, setHoverPoint] = useState<Position | null>(null);

  // Load existing tent if editing (path is .../tents/<uuid> rather than /new).
  useEffect(() => {
    if (!tentId || tentId === 'new') return;
    let cancelled = false;
    supabase
      .from('tents')
      .select('*, tent_categories(category_id)')
      .eq('id', tentId)
      .single()
      .then(({ data }) => {
        if (cancelled || !data) return;
        // tent_categories is an array of { category_id }; flatten to string[].
        const tcRaw = (data as unknown as { tent_categories?: Array<{ category_id: string }> })
          .tent_categories ?? [];
        const loadedCategoryIds = tcRaw.map((tc) => tc.category_id);
        // Strip the join wrapper before storing as Tent.
        const { tent_categories: _ignored, ...rest } = data as unknown as Record<string, unknown> & {
          tent_categories?: unknown;
        };
        setTent(rest as Tent);
        setCategoryIds(loadedCategoryIds);
        setPosition((rest as { position?: unknown }).position as Position);
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

    // Fields written on both insert and update. event_id is the partition key
    // and must NOT appear in the update payload — it would be a no-op at best
    // and a constraint violation if we ever lock the column down later. The
    // trigger fills display_number when omitted (we still send null on update
    // for explicit-null-clears the admin makes via the form).
    const sharedFields = {
      slug: values.slug,
      name: values.name,
      description_de: values.description_de || null,
      description_en: values.description_en || null,
      address: values.address || null,
      display_number: values.display_number ?? null,
      website_url: values.website_url || null,
      instagram_url: values.instagram_url || null,
      facebook_url: values.facebook_url || null,
      email_public: values.email_public || null,
      position,
    };

    try {
      let savedTentId: string;

      if (tent) {
        // Edit: update the row.
        const { error } = await supabase.from('tents').update(sharedFields).eq('id', tent.id);
        if (error) throw new Error(error.message);
        savedTentId = tent.id;
      } else {
        // New: insert and grab the trigger-assigned row's id.
        const { data, error } = await supabase
          .from('tents')
          .insert({ event_id: event.id, ...sharedFields })
          .select('id')
          .single();
        if (error || !data) throw new Error(error?.message ?? 'tent insert returned no row');
        savedTentId = (data as { id: string }).id;
      }

      // Replace tent_categories: delete-all-then-insert. Simpler than diffing.
      const { error: delErr } = await supabase
        .from('tent_categories')
        .delete()
        .eq('tent_id', savedTentId);
      if (delErr) throw new Error(delErr.message);

      if (values.category_ids.length > 0) {
        const { error: insErr } = await supabase
          .from('tent_categories')
          .insert(
            values.category_ids.map((cid) => ({ tent_id: savedTentId, category_id: cid })),
          );
        if (insErr) throw new Error(insErr.message);
      }

      navigate(`/admin/events/${event.slug}/tents`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      showError(`Save failed: ${msg}`);
      // Don't re-throw — let RHF reset isSubmitting normally.
    }
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
          initial={tent ? { ...tent, category_ids: categoryIds } : undefined}
          categories={categories}
          position={position}
          onRequestPlace={() => setPlaceMode(true)}
          onSubmit={onSubmit}
        />
        {tent && (
          <div className="mt-6">
            <PhotoUploadZone eventId={event.id} tentId={tent.id} />
          </div>
        )}
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
