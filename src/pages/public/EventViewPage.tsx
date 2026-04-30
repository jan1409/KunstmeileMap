import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEvent } from '../../hooks/useEvent';
import { useTents } from '../../hooks/useTents';
import { useCategories } from '../../hooks/useCategories';
import { usePhotos } from '../../hooks/usePhotos';
import { SplatViewer } from '../../components/SplatViewer';
import { SidePanel } from '../../components/SidePanel';
import { TopBar } from '../../components/TopBar';
import type { MarkerData } from '../../lib/three/MarkerLayer';

// Fallback splat used when an event has no splat_url assigned yet (pre-capture).
// Lives in public/ (gitignored — production splats go to Cloudflare R2 via the
// admin Settings page in A3-T12).
const PLACEHOLDER_SPLAT = '/OldTrainStation.splat';

function isXyz(v: unknown): v is { x: number; y: number; z: number } {
  return (
    typeof v === 'object' && v !== null &&
    typeof (v as { x?: unknown }).x === 'number' &&
    typeof (v as { y?: unknown }).y === 'number' &&
    typeof (v as { z?: unknown }).z === 'number'
  );
}

export default function EventViewPage() {
  const { t } = useTranslation();
  const { eventSlug, tentSlug } = useParams();
  const navigate = useNavigate();

  const { event, loading: loadingEvent, error: errorEvent } = useEvent(eventSlug);
  const { tents } = useTents(event?.id);
  const { categories } = useCategories(event?.id);

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());

  const selectedTent = useMemo(
    () => tents.find((tnt) => tnt.slug === tentSlug) ?? null,
    [tents, tentSlug],
  );
  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedTent?.category_id) ?? null,
    [categories, selectedTent],
  );
  const photoUrls = usePhotos(selectedTent?.id);

  const splatUrl = event?.splat_url ?? PLACEHOLDER_SPLAT;
  const splatOrigin = useMemo(() => {
    const o = event?.splat_origin;
    return isXyz(o) ? o : undefined;
  }, [event?.splat_origin]);

  // Build markers from real tents. Skip rows whose `position` JSON isn't a
  // valid {x,y,z} (defensive — admin Place Mode in A3-T05 will only emit valid).
  const markers: MarkerData[] = useMemo(() => {
    const filterActive = selectedCategoryIds.size > 0;
    return tents
      .filter((tnt): tnt is typeof tnt & { position: { x: number; y: number; z: number } } =>
        isXyz(tnt.position),
      )
      .map((tnt) => {
        const matchesFilter =
          !filterActive || (tnt.category_id != null && selectedCategoryIds.has(tnt.category_id));
        const cat = categories.find((c) => c.id === tnt.category_id);
        return {
          id: tnt.id,
          position: tnt.position,
          category_icon: cat?.icon ?? null,
          dimmed: !matchesFilter,
        };
      });
  }, [tents, categories, selectedCategoryIds]);

  function selectTentBySlug(slug: string | null) {
    if (!event) return;
    if (slug) {
      navigate(`/${event.slug}/tent/${slug}`);
    } else {
      navigate(`/${event.slug}`);
    }
  }

  // Loading + error states
  if (loadingEvent) {
    return (
      <main className="flex h-screen w-screen items-center justify-center text-white/70">
        <p className="text-sm">{t('app.loading')}</p>
      </main>
    );
  }
  if (errorEvent) {
    return (
      <main className="flex h-screen w-screen flex-col items-center justify-center gap-3 text-white">
        <p className="text-sm text-red-300">{t('app.error_load')}</p>
        <p className="text-xs text-white/50">{errorEvent.message}</p>
        <button
          onClick={() => location.reload()}
          className="rounded bg-white/10 px-3 py-1 text-sm hover:bg-white/20"
        >
          {t('app.retry')}
        </button>
      </main>
    );
  }
  if (!event) {
    return (
      <main className="flex h-screen w-screen items-center justify-center text-white/70">
        <p className="text-sm">No event found.</p>
      </main>
    );
  }

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <SplatViewer
        splatUrl={splatUrl}
        origin={splatOrigin}
        markers={markers}
        selectedTentId={selectedTent?.id ?? null}
        onMarkerClick={(id) => {
          const tnt = tents.find((x) => x.id === id);
          if (!tnt) return;
          // Toggle: same tent selected → deselect.
          selectTentBySlug(tnt.slug === tentSlug ? null : tnt.slug);
        }}
      />
      <TopBar
        tents={tents}
        categories={categories}
        selectedCategoryIds={selectedCategoryIds}
        onSelectTent={(tnt) => selectTentBySlug(tnt.slug)}
        onToggleCategory={(id) => {
          setSelectedCategoryIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          });
        }}
        onClearCategories={() => setSelectedCategoryIds(new Set())}
      />
      <SidePanel
        tent={selectedTent}
        category={selectedCategory}
        photoUrls={photoUrls}
        onClose={() => selectTentBySlug(null)}
      />
    </main>
  );
}
