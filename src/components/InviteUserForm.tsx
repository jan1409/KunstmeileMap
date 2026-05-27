import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { useToast } from './ToastProvider';

type Role = 'contributor' | 'editor' | 'owner';

interface Props {
  eventId: string;
  onInvited: () => void;
}

interface InviteResponse {
  ok?: boolean;
  user_id?: string | null;
  status?: 'invited' | 'added_to_existing_user';
  error?: string;
  existing_role?: Role;
  message?: string;
}

export function InviteUserForm({ eventId, onInvited }: Props) {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('contributor');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: { email: email.trim(), event_id: eventId, role_in_event: role },
      });
      const result = (data ?? {}) as InviteResponse;
      if (error) {
        showError(t('admin.users.invite_error', { message: error.message }));
        return;
      }
      if (result.error === 'already_member') {
        showError(t('admin.users.invite_already_member', { email: email.trim(), role: result.existing_role ?? '' }));
        return;
      }
      if (result.error) {
        showError(t('admin.users.invite_error', { message: result.message ?? result.error }));
        return;
      }
      if (result.status === 'added_to_existing_user') {
        showSuccess(t('admin.users.invite_added_to_existing', { email: email.trim(), role }));
      } else {
        showSuccess(t('admin.users.invite_success', { email: email.trim() }));
      }
      setEmail('');
      onInvited();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mb-4 rounded border border-white/10 p-3">
      <h2 className="mb-2 text-sm font-semibold">{t('admin.users.invite_heading')}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto]">
        <label className="block text-xs">
          <span className="block text-white/60">{t('admin.users.invite_email_label')}</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input mt-1"
            aria-label={t('admin.users.invite_email_label')}
          />
        </label>
        <label className="block text-xs">
          <span className="block text-white/60">{t('admin.users.invite_role_label')}</span>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="input mt-1">
            <option value="contributor">{t('admin.users.role_contributor')}</option>
            <option value="editor">{t('admin.users.role_editor')}</option>
            <option value="owner">{t('admin.users.role_owner')}</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={busy}
          className="self-end rounded bg-white/20 px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {busy ? t('admin.users.invite_sending') : t('admin.users.invite_submit')}
        </button>
      </div>
    </form>
  );
}
