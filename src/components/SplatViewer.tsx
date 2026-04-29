import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useTranslation } from 'react-i18next';
import { createSplatScene, type SplatSceneHandle } from '../lib/three/SplatScene';
import { MarkerLayer, type MarkerData } from '../lib/three/MarkerLayer';

interface Props {
  splatUrl: string;
  origin?: { x: number; y: number; z: number };
  markers?: MarkerData[];
  selectedTentId?: string | null;
  onMarkerClick?: (id: string) => void;
  onSceneReady?: (handle: SplatSceneHandle) => void;
}

export function SplatViewer({
  splatUrl,
  origin,
  markers,
  selectedTentId,
  onMarkerClick,
  onSceneReady,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<SplatSceneHandle | null>(null);
  const layerRef = useRef<MarkerLayer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { t } = useTranslation();

  // Initialise scene + marker layer once per splat URL/origin.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    createSplatScene({ canvas, splatUrl, origin })
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
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e : new Error(String(e)));
        setLoading(false);
      });

    return () => {
      cancelled = true;
      layerRef.current?.dispose();
      layerRef.current = null;
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, [splatUrl, origin?.x, origin?.y, origin?.z, onSceneReady]);

  // Sync markers + selection state into the layer.
  useEffect(() => {
    if (!layerRef.current) return;
    const list = markers ?? [];
    layerRef.current.setMarkers(
      list.map((m) => ({
        ...m,
        selected: m.id === selectedTentId,
        dimmed: selectedTentId != null && m.id !== selectedTentId,
      })),
    );
  }, [markers, selectedTentId]);

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
