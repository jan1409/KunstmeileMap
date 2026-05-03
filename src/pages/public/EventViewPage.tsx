import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEvent } from '../../hooks/useEvent';
import { useTents } from '../../hooks/useTents';
import { useCategories } from '../../hooks/useCategories';
import { usePhotos } from '../../hooks/usePhotos';
import { useCanEditEvent } from '../../hooks/useCanEditEvent';
import { useIsMobile } from '../../hooks/useIsMobile';
import { SplatViewer } from '../../components/SplatViewer';
import { SidePanel } from '../../components/SidePanel';
import { TopBar } from '../../components/TopBar';
import { SetCameraDefaultButton } from '../../components/SetCameraDefaultButton';
import type { Category } from '../../lib/supabase';
import type { MarkerData } from '../../lib/three/MarkerLayer';
import type { SplatSceneHandle } from '../../lib/three/SplatScene';
import * as THREE from 'three';
import { parseCameraDefault, FALLBACK_CAMERA } from '../../lib/three/cameraDefault';
import { flyTo, computeLandingPose, FlyCancelledError } from '../../lib/three/cameraFlyby';
import type { FlyToHandle } from '../../lib/three/cameraFlyby';
import { BackToOverviewButton } from '../../components/BackToOverviewButton';
import { WalkModeButton } from '../../components/WalkModeButton';
import { selectVisibleMarkers, isXyz } from '../../lib/markers';
import {
  WalkModeController,
  walkAnimateTo,
  computeWalkDuration,
  computeEyePose,
  type WalkAnimateHandle,
} from '../../lib/three/walkMode';
import { useToast } from '../../components/ToastProvider';

// Fallback splat used when an event has no splat_url assigned yet (pre-capture).
// Lives in public/ (gitignored — production splats go to Cloudflare R2 via the
// admin Settings page in A3-T12).
const PLACEHOLDER_SPLAT = '/OldTrainStation.splat';

export default function EventViewPage() {
  const { t } = useTranslation();
  const { showError } = useToast();
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
  const isMobile = useIsMobile();
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
  const [walkMode, setWalkMode] = useState(false);
  const walkModeRef = useRef<WalkModeController | null>(null);
  const walkEntryRef = useRef<WalkAnimateHandle | null>(null);
  const walkPriorControlsRef = useRef<{ enabled: boolean; damping: boolean } | null>(null);
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
      const pose = computeLandingPose(
        handle.camera,
        handle.controls.target,
        tentPosition,
        { aimHigh: isMobile },
      );
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
    [isMobile],
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

  const toggleWalkMode = useCallback(() => {
    const handle = sceneHandleRef.current;
    if (!handle) return;

    // Ignore the click if an entry transition is already in flight — prevents
    // a double-click from kicking off two concurrent entry walks (or from
    // entering exit branch while entry is still resolving).
    if (walkEntryRef.current) return;

    if (walkMode) {
      // EXIT: dispose controller, restore controls flags, fly back to overview.
      walkModeRef.current?.dispose();
      walkModeRef.current = null;
      // Restore controls BEFORE flyHome — flyHome's flyTo saves the current
      // state at start and restores to the same at end. We want it to land
      // back at the user's pre-walk-mode flags, so we restore here first.
      if (walkPriorControlsRef.current) {
        handle.controls.enabled = walkPriorControlsRef.current.enabled;
        handle.controls.enableDamping = walkPriorControlsRef.current.damping;
        walkPriorControlsRef.current = null;
      }
      setWalkMode(false);
      flyHome();
      return;
    }

    // ENTER: drop camera to eye-level at current xz.
    const downRay = new THREE.Raycaster();
    downRay.setFromCamera(new THREE.Vector2(0, 0), handle.camera);
    downRay.near = 0;
    downRay.far = 200;
    const hits: THREE.Intersection[] = [];
    handle.splatMesh.raycast(downRay, hits);
    const groundHit = hits[0]?.point;
    if (!groundHit) {
      showError(t('viewer.walk_no_ground'));
      return;
    }

    const dropTarget = computeEyePose(groundHit);
    // Save originals so we can restore on exit. Both flags must be disabled
    // during walk mode: enabled=false stops user input from OrbitControls;
    // enableDamping=false stops controls.update() from fighting walkAnimateTo's
    // y writes each frame (the render loop runs frame hooks BEFORE
    // controls.update(), so without this the damping pulls the camera back
    // toward the orbit center every frame and the drop never lands).
    walkPriorControlsRef.current = {
      enabled: handle.controls.enabled,
      damping: handle.controls.enableDamping,
    };
    handle.controls.enabled = false;
    handle.controls.enableDamping = false;
    const dx = dropTarget.x - handle.camera.position.x;
    const dz = dropTarget.z - handle.camera.position.z;
    const distXZ = Math.hypot(dx, dz);
    const fly = walkAnimateTo(
      handle.camera,
      handle.addFrameHook,
      () => groundHit.y, // entry: hold the single ground sample
      { target: dropTarget, durationMs: computeWalkDuration(Math.max(distXZ, 1)) },
    );
    walkEntryRef.current = fly;
    fly.promise
      .then(() => {
        walkEntryRef.current = null;
        if (!canvasRef.current) return;
        const signs = tents
          .filter((t) => isXyz(t.position))
          .map((t) => ({
            id: t.id,
            position: new THREE.Vector3(
              (t.position as { x: number; y: number; z: number }).x,
              (t.position as { x: number; y: number; z: number }).y,
              (t.position as { x: number; y: number; z: number }).z,
            ),
          }));
        flushSync(() => {
          setWalkMode(true);
          setCameraAwayFromDefault(true);
        });
        walkModeRef.current = new WalkModeController({
          canvas: canvasRef.current,
          camera: handle.camera,
          splatMesh: handle.splatMesh,
          addFrameHook: handle.addFrameHook,
          signs,
          // onTentReached wired in PR-W2.
        });
      })
      .catch(() => {
        walkEntryRef.current = null;
        // Cancelled (e.g. user toggled exit during drop) — restore controls.
        if (walkPriorControlsRef.current) {
          handle.controls.enabled = walkPriorControlsRef.current.enabled;
          handle.controls.enableDamping = walkPriorControlsRef.current.damping;
          walkPriorControlsRef.current = null;
        }
      });
  }, [walkMode, flyHome, tents, showError, t]);

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

  useEffect(() => {
    return () => {
      walkModeRef.current?.dispose();
      walkModeRef.current = null;
    };
  }, []);

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
        walkMode={walkMode}
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
      <WalkModeButton active={walkMode} onToggle={toggleWalkMode} panelOpen={selectedTent !== null} />
      <BackToOverviewButton
        visible={cameraAwayFromDefault && cameraDefault != null}
        onClick={flyHome}
        panelOpen={selectedTent !== null}
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
