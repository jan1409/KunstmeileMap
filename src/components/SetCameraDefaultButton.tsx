import { useState, type RefObject } from 'react';
import { supabase } from '../lib/supabase';
import { readCameraDefault } from '../lib/three/cameraDefault';
import type { SplatSceneHandle } from '../lib/three/SplatScene';
import { useAuth } from './AuthProvider';
import { useProfile } from '../hooks/useProfile';

interface Props {
  eventId: string;
  sceneHandleRef: RefObject<SplatSceneHandle | null>;
}

/**
 * Floating button on the public viewer that lets an admin save the current
 * camera position + orbit target as the event's default landing view.
 *
 * Renders nothing for visitors / non-admins. Visitors with no session never
 * trigger the profile fetch (useProfile is no-op when userId is undefined),
 * so there is no overhead on the public path.
 */
export function SetCameraDefaultButton({ eventId, sceneHandleRef }: Props) {
  const { session } = useAuth();
  const { profile } = useProfile(session?.user.id);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (profile?.role !== 'admin') return null;

  async function save() {
    const handle = sceneHandleRef.current;
    if (!handle) return;
    setBusy(true);
    setError(null);
    setSavedAt(null);
    const cameraDefault = readCameraDefault(handle.camera, handle.controls);
    const { error: err } = await supabase
      .from('events')
      .update({ splat_camera_default: cameraDefault })
      .eq('id', eventId);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSavedAt(Date.now());
  }

  return (
    <div className="fixed bottom-12 left-4 z-30 flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="rounded bg-white/10 px-3 py-2 text-xs text-white shadow-lg backdrop-blur hover:bg-white/20 disabled:opacity-50"
      >
        {busy ? '…' : 'Save current view as default'}
      </button>
      {savedAt && !error && (
        <span className="rounded bg-green-500/20 px-2 py-0.5 text-xs text-green-200">
          Saved.
        </span>
      )}
      {error && (
        <p role="alert" className="rounded bg-red-500/20 px-2 py-0.5 text-xs text-red-200">
          {error}
        </p>
      )}
    </div>
  );
}
