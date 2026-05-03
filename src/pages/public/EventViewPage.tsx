import { useCallback, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEvent } from '../../hooks/useEvent';
import { useTents } from '../../hooks/useTents';
import { useCategories } from '../../hooks/useCategories';
import { usePhotos } from '../../hooks/usePhotos';
import { SplatViewer } from '../../components/SplatViewer';
import { SidePanel } from '../../components/SidePanel';
import { TopBar } from '../../components/TopBar';
import { SetCameraDefaultButton } from '../../components/SetCameraDefaultButton';
import type { Category } from '../../lib/supabase';
import type { MarkerData } from '../../lib/three/MarkerLayer';
import type { SplatSceneHandle } from '../../lib/three/SplatScene';
import { parseCameraDefault } from '../../lib/three/cameraDefault';
import { selectVisibleMarkers } from '../../lib/markers';

// Fallback splat used when an event has no splat_url assigned yet (pre-capture).
// Lives in public/ (gitignored — production splats go to Cloudflare R2 via the
// admin Settings page in A3-T12).
const PLACEHOLDER_SPLAT = '/OldTrainStation.splat';

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
  const selectedCategories = useMemo<Category[]>(
    () => selectedTent?.categories ?? [],
    [selectedTent],
  );
  const photoUrls = usePhotos(selectedTent?.id);

  const splatUrl = event?.splat_url ?? PLACEHOLDER_SPLAT;
  const splatOrigin = useMemo(() => {
    const o = event?.splat_origin;
    if (
      typeof o === 'object' && o !== null &&
      typeof (o as { x?: unknown }).x === 'number' &&
      typeof (o as { y?: unknown }).y === 'number' &&
      typeof (o as { z?: unknown }).z === 'number'
    ) {
      return o as { x: number; y: number; z: number };
    }
    return undefined;
  }, [event?.splat_origin]);
  const cameraDefault = useMemo(
    () => parseCameraDefault(event?.splat_camera_default),
    [event?.splat_camera_default],
  );

  const sceneHandleRef = useRef<SplatSceneHandle | null>(null);
  const onSceneReady = useCallback((handle: SplatSceneHandle) => {
    sceneHandleRef.current = handle;
  }, []);

  const markers: MarkerData[] = useMemo(
    () => selectVisibleMarkers(tents, selectedCategoryIds, selectedTent?.id ?? null),
    [tents, selectedCategoryIds, selectedTent?.id],
  );

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
        cameraDefault={cameraDefault}
        markers={markers}
        selectedTentId={selectedTent?.id ?? null}
        onMarkerClick={(id) => {
          const tnt = tents.find((x) => x.id === id);
          if (!tnt) return;
          // Toggle: same tent selected → deselect.
          selectTentBySlug(tnt.slug === tentSlug ? null : tnt.slug);
        }}
        onSceneReady={onSceneReady}
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
        categories={selectedCategories}
        photoUrls={photoUrls}
        onClose={() => selectTentBySlug(null)}
      />
      <SetCameraDefaultButton eventId={event.id} sceneHandleRef={sceneHandleRef} />
      <footer className="absolute bottom-0 left-0 right-0 z-10 flex justify-center gap-4 bg-gradient-to-t from-black/60 to-transparent p-2 text-xs text-white/70">
        <Link to="/impressum" className="hover:text-white">
          {t('footer.impressum')}
        </Link>
        <Link to="/datenschutz" className="hover:text-white">
          {t('footer.datenschutz')}
        </Link>
      </footer>
    </main>
  );
}
