import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEvent } from '../../hooks/useEvent';
import { useTents } from '../../hooks/useTents';
import { useCategories } from '../../hooks/useCategories';
import { usePhotos } from '../../hooks/usePhotos';
import { useCanEditEvent } from '../../hooks/useCanEditEvent';
import { SplatViewer } from '../../components/SplatViewer';
import { SidePanel } from '../../components/SidePanel';
import { TopBar } from '../../components/TopBar';
import { SetCameraDefaultButton } from '../../components/SetCameraDefaultButton';
import type { Category } from '../../lib/supabase';
import type { MarkerData } from '../../lib/three/MarkerLayer';
import type { SplatSceneHandle } from '../../lib/three/SplatScene';
import { parseCameraDefault, FALLBACK_CAMERA } from '../../lib/three/cameraDefault';
import { flyTo, computeLandingPose, FlyCancelledError } from '../../lib/three/cameraFlyby';
import type { FlyToHandle } from '../../lib/three/cameraFlyby';
import { BackToOverviewButton } from '../../components/BackToOverviewButton';
import { selectVisibleMarkers, isXyz } from '../../lib/markers';

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
  const { canEdit } = useCanEditEvent(event?.id);
  const [photosReloadKey, setPhotosReloadKey] = useState(0);
  const photoUrls = usePhotos(selectedTent?.id, photosReloadKey);

  const splatUrl = event?.splat_url ?? PLACEHOLDER_SPLAT;
  const splatOrigin = useMemo(() => {
    const o = event?.splat_origin;
    return isXyz(o) ? o : undefined;
  }, [event?.splat_origin]);
  const cameraDefault = useMemo(
    () => parseCameraDefault(event?.splat_camera_default),
    [event?.splat_camera_default],
  );

  const sceneHandleRef = useRef<SplatSceneHandle | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inFlightFlyRef = useRef<FlyToHandle | null>(null);
  const didInitialFlybyRef = useRef(false);
  const [cameraAwayFromDefault, setCameraAwayFromDefault] = useState(false);
  // Flips true once the SplatScene is ready. Used as a dep in the cold-load
  // deep-link effect so it re-runs when the scene finishes initialising.
  const [sceneReady, setSceneReady] = useState(false);

  const onCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    canvasRef.current = canvas;
  }, []);

  const onSceneReady = useCallback((handle: SplatSceneHandle) => {
    sceneHandleRef.current = handle;
    setSceneReady(true);
    // Register OrbitControls 'start' listener here (rather than in a useEffect)
    // to guarantee the handle is non-null when the listener is attached.
    const onStart = () => setCameraAwayFromDefault(true);
    handle.controls.addEventListener('start', onStart);
    // No explicit removeEventListener needed: when the scene tears down,
    // SplatViewer disposes and nulls handleRef.current. The controls object
    // becomes unreachable, taking its _listeners map (and this closure) with
    // it. OrbitControls.dispose() only removes DOM listeners — it does NOT
    // flush EventDispatcher listeners — so GC is the actual cleanup path.
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

  const flyToTent = useCallback(
    (tentPosition: { x: number; y: number; z: number }) => {
      const handle = sceneHandleRef.current;
      if (!handle) return;
      // Cancel any in-flight flyby first.
      inFlightFlyRef.current?.cancel();
      const pose = computeLandingPose(handle.camera, handle.controls.target, tentPosition);
      const fly = flyTo(handle.camera, handle.controls, handle.addFrameHook, pose);
      inFlightFlyRef.current = fly;
      fly.promise
        .then(() => {
          if (inFlightFlyRef.current === fly) inFlightFlyRef.current = null;
        })
        .catch((err) => {
          if (!(err instanceof FlyCancelledError)) throw err;
          if (inFlightFlyRef.current === fly) inFlightFlyRef.current = null;
        });
      setCameraAwayFromDefault(true);

      // Cancel on pointerdown — gives the user instant control during a flyby.
      const canvas = canvasRef.current;
      if (canvas) {
        const onDown = () => {
          fly.cancel();
        };
        canvas.addEventListener('pointerdown', onDown, { once: true });
        // Cleanup the listener if the flyby completes before pointerdown.
        fly.promise.finally(() => canvas.removeEventListener('pointerdown', onDown));
      }
    },
    [],
  );

  const flyHome = useCallback(() => {
    const handle = sceneHandleRef.current;
    if (!handle) return;
    inFlightFlyRef.current?.cancel();
    const target = cameraDefault ?? FALLBACK_CAMERA;
    const fly = flyTo(handle.camera, handle.controls, handle.addFrameHook, target);
    inFlightFlyRef.current = fly;
    fly.promise
      .then(() => {
        if (inFlightFlyRef.current === fly) inFlightFlyRef.current = null;
        setCameraAwayFromDefault(false);
      })
      .catch((err) => {
        if (!(err instanceof FlyCancelledError)) throw err;
        if (inFlightFlyRef.current === fly) inFlightFlyRef.current = null;
      });
  }, [cameraDefault]);

  // Cold-load deep-link: if a tentSlug is already in the URL when the scene
  // finishes loading, fly to that tent once. sceneReady in deps ensures this
  // re-runs after the async scene init completes (selectedTent may already be
  // set by then, but without sceneReady the effect would have bailed early).
  useEffect(() => {
    if (didInitialFlybyRef.current) return;
    if (!sceneReady || !selectedTent) return;
    const pos = selectedTent.position;
    if (!isXyz(pos)) return;
    // Defer past the current sync task to keep state writes (didInitialFlybyRef)
    // out of the render commit phase.
    queueMicrotask(() => {
      flyToTent(pos);
      didInitialFlybyRef.current = true;
    });
  }, [selectedTent, flyToTent, sceneReady]);

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
          if (tnt.slug === tentSlug) {
            // Toggle: same tent selected → deselect, no flyby.
            selectTentBySlug(null);
            return;
          }
          selectTentBySlug(tnt.slug);
          if (isXyz(tnt.position)) flyToTent(tnt.position);
        }}
        onSceneReady={onSceneReady}
        onCanvasReady={onCanvasReady}
      />
      <TopBar
        tents={tents}
        categories={categories}
        selectedCategoryIds={selectedCategoryIds}
        onSelectTent={(tnt) => {
          selectTentBySlug(tnt.slug);
          if (isXyz(tnt.position)) flyToTent(tnt.position);
        }}
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
        eventId={event.id}
        canEdit={canEdit}
        onPhotosChanged={() => setPhotosReloadKey((n) => n + 1)}
      />
      <SetCameraDefaultButton eventId={event.id} sceneHandleRef={sceneHandleRef} />
      <BackToOverviewButton
        visible={cameraAwayFromDefault && cameraDefault != null}
        onClick={flyHome}
      />
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
