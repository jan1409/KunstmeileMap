import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createSplatScene, type SplatSceneHandle } from '../lib/three/SplatScene';

interface Props {
  splatUrl: string;
  origin?: { x: number; y: number; z: number };
  onSceneReady?: (handle: SplatSceneHandle) => void;
}

export function SplatViewer({ splatUrl, origin, onSceneReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let handle: SplatSceneHandle | undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);

    createSplatScene({ canvas, splatUrl, origin })
      .then((h) => {
        if (cancelled) {
          h.dispose();
          return;
        }
        handle = h;
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
      handle?.dispose();
    };
  }, [splatUrl, origin?.x, origin?.y, origin?.z, onSceneReady]);

  return (
    <div className="relative h-full w-full">
      <canvas ref={canvasRef} className="block h-full w-full" aria-label="Interactive 3D map" />
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
