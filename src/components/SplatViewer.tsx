import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useTranslation } from 'react-i18next';
import { createSplatScene, type SplatSceneHandle } from '../lib/three/SplatScene';
import { MarkerLayer, type MarkerData } from '../lib/three/MarkerLayer';
import { PlaceModeController } from '../lib/three/PlaceMode';
import { applyCameraDefault, type CameraDefault } from '../lib/three/cameraDefault';

interface Props {
  splatUrl: string;
  origin?: { x: number; y: number; z: number };
  markers?: MarkerData[];
  selectedTentId?: string | null;
  onMarkerClick?: (id: string) => void;
  onSceneReady?: (handle: SplatSceneHandle) => void;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  /**
   * Initial camera position + target. Applied on scene init AND when the
   * value changes after init (so admin "save as default" → next render
   * snaps the camera to the saved view).
   */
  cameraDefault?: CameraDefault | null;
  /**
   * When true, the cursor turns to a crosshair and pointer events on the
   * canvas raycast against the splat surface. Hits are reported via
   * `onPlaceHover` / `onPlaceClick` as world-space coordinates.
   */
  placeMode?: boolean;
  onPlaceHover?: (point: { x: number; y: number; z: number } | null) => void;
  onPlaceClick?: (point: { x: number; y: number; z: number }) => void;
}

export function SplatViewer({
  splatUrl,
  origin,
  markers,
  selectedTentId,
  onMarkerClick,
  onSceneReady,
  onCanvasReady,
  cameraDefault,
  placeMode,
  onPlaceHover,
  onPlaceClick,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<SplatSceneHandle | null>(null);
  const layerRef = useRef<MarkerLayer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  // Flips true after createSplatScene resolves and the MarkerLayer is in the
  // scene. Markers effect uses this in its deps so it re-runs once the layer
  // is ready (otherwise the initial markers never get placed because the
  // markers effect ran before the async scene init finished).
  const [sceneReady, setSceneReady] = useState(false);
  const { t } = useTranslation();

  // Initialise scene + marker layer once per splat URL/origin.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    createSplatScene({ canvas, splatUrl, origin, cameraDefault })
      .then((h) => {
        if (cancelled) {
          h.dispose();
          return;
        }
        handleRef.current = h;
        const layer = new MarkerLayer();
        layerRef.current = layer;
        h.scene.add(layer.group);
        onSceneReady?.(h);
        onCanvasReady?.(canvas);
        setLoading(false);
        setSceneReady(true);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e : new Error(String(e)));
        setLoading(false);
      });

    return () => {
      cancelled = true;
      setSceneReady(false);
      layerRef.current?.dispose();
      layerRef.current = null;
      handleRef.current?.dispose();
      handleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- destructured origin coords avoid re-init when parent passes a fresh {x,y,z} object literal each render with unchanged values. cameraDefault is intentionally NOT a dep here — it would force a full scene re-init (re-downloads the splat) every time it changes; instead the next useEffect re-applies it cheaply on the existing handle.
  }, [splatUrl, origin?.x, origin?.y, origin?.z, onSceneReady, onCanvasReady]);

  // Re-apply the camera default whenever the prop changes after the scene is
  // up. This is the admin-save-then-refetch path: after saving, the parent
  // re-fetches the event row → cameraDefault prop changes → camera snaps to
  // the saved view without rebuilding the scene.
  useEffect(() => {
    if (!sceneReady || !handleRef.current) return;
    applyCameraDefault(handleRef.current.camera, handleRef.current.controls, cameraDefault ?? null);
  }, [cameraDefault, sceneReady]);

  // Sync markers + selection state into the layer. Depends on `sceneReady` so
  // it re-runs after the async scene init completes — without this, markers
  // passed in on first render never get placed because layerRef.current is
  // still null when the effect fires.
  useEffect(() => {
    if (!sceneReady || !layerRef.current) return;
    const list = markers ?? [];
    layerRef.current.setMarkers(
      list.map((m) => ({
        ...m,
        selected: m.id === selectedTentId,
        // Dim if EITHER the caller marked it dimmed (e.g., category filter
        // excludes it) OR a different tent is selected.
        dimmed:
          m.dimmed === true ||
          (selectedTentId != null && m.id !== selectedTentId),
      })),
    );
  }, [markers, selectedTentId, sceneReady]);

  // Tap-vs-drag click detection on the canvas.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let start: { x: number; y: number; t: number } | null = null;
    function onDown(e: PointerEvent) {
      start = { x: e.clientX, y: e.clientY, t: Date.now() };
    }
    function onUp(e: PointerEvent) {
      const s = start;
      start = null;
      if (!s) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      const dt = Date.now() - s.t;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6 || dt > 500) return; // drag, not tap
      const handle = handleRef.current;
      const layer = layerRef.current;
      if (!handle || !layer) return;
      const rect = canvas!.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      const id = layer.hitTest(ndc, handle.camera);
      if (id) onMarkerClick?.(id);
    }
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
    };
  }, [onMarkerClick]);

  // Place mode: raycast against the splat surface and report hits via the
  // hover/click callbacks. Depends on `sceneReady` so we don't try to install
  // listeners before `handleRef.current.splatMesh` exists.
  useEffect(() => {
    if (!placeMode || !sceneReady) return;
    const handle = handleRef.current;
    const canvas = canvasRef.current;
    if (!handle || !canvas) return;
    const ctrl = new PlaceModeController({
      canvas,
      camera: handle.camera,
      splatMesh: handle.splatMesh,
      onHover: (p) => onPlaceHover?.(p ? { x: p.x, y: p.y, z: p.z } : null),
      onClick: (p) => onPlaceClick?.({ x: p.x, y: p.y, z: p.z }),
    });
    return () => ctrl.dispose();
  }, [placeMode, sceneReady, onPlaceHover, onPlaceClick]);

  return (
    <div className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        aria-label="Interactive 3D map"
      />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
          {t('app.loading')}
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <p className="text-sm text-red-300">{t('app.error_load')}</p>
          <button
            onClick={() => location.reload()}
            className="rounded bg-white/10 px-3 py-1 text-sm hover:bg-white/20"
          >
            {t('app.retry')}
          </button>
        </div>
      )}
    </div>
  );
}
