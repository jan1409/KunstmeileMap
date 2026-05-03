import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { useToast } from './ToastProvider';

interface Props {
  eventId: string;
  tentId: string;
  onUploaded: () => void;
}

/**
 * Single-photo upload control for the public viewer's SidePanel. Visible
 * only to admins and per-event owners/editors (gated by useCanEditEvent
 * upstream). One file at a time; remove/reorder lives on the admin
 * tent-edit page.
 */
export function AddPhotosControl({ eventId, tentId, onUploaded }: Props) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { showError } = useToast();

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setBusy(true);
    try {
      const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
      const path = `${eventId}/${tentId}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage.from('tent-photos').upload(path, file);
      if (upErr) {
        showError(t('side_panel.upload_error', { message: upErr.message }));
        return;
      }

      // Count existing photos to compute the next display_order. count-only
      // round-trip — cheaper than fetching all rows.
      const { count, error: countErr } = await supabase
        .from('tent_photos')
        .select('id', { count: 'exact', head: true })
        .eq('tent_id', tentId);
      if (countErr) {
        showError(t('side_panel.upload_error', { message: countErr.message }));
        return;
      }

      const { error: insErr } = await supabase.from('tent_photos').insert({
        tent_id: tentId,
        storage_path: path,
        display_order: count ?? 0,
      });
      if (insErr) {
        showError(t('side_panel.upload_error', { message: insErr.message }));
        return;
      }

      onUploaded();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="rounded bg-white/10 px-3 py-1 text-xs hover:bg-white/20 disabled:opacity-50"
      >
        {busy ? t('side_panel.uploading') : `+ ${t('side_panel.add_photo')}`}
      </button>
      <input
        ref={inputRef}
        data-testid="add-photo-input"
        type="file"
        accept="image/*"
        onChange={onChange}
        className="hidden"
      />
    </div>
  );
}
