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
  status?: 'invited' | 'added_to_existing_user' | 'resent' | 'manually_created';
  error?: string;
  existing_role?: Role;
  message?: string;
}

interface InviteBody {
  email: string;
  event_id: string;
  role_in_event: Role;
  password?: string;
}

export function InviteUserForm({ eventId, onInvited }: Props) {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('contributor');
  const [busy, setBusy] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [password, setPassword] = useState('');
  const [lastCreated, setLastCreated] = useState<{ email: string; password: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    if (manualMode && password.length < 8) {
      showError(t('admin.users.manual_password_too_short'));
      return;
    }
    setBusy(true);
    try {
      const trimmedEmail = email.trim();
      const body: InviteBody = { email: trimmedEmail, event_id: eventId, role_in_event: role };
      if (manualMode) {
        body.password = password;
      }
      const { data, error } = await supabase.functions.invoke('invite-user', { body });
      const result = (data ?? {}) as InviteResponse;
      if (error) {
        showError(t('admin.users.invite_error', { message: error.message }));
        return;
      }
      if (result.error === 'already_member') {
        showError(t('admin.users.invite_already_member', { email: trimmedEmail, role: result.existing_role ?? '' }));
        return;
      }
      if (result.error === 'password_too_short') {
        showError(t('admin.users.manual_password_too_short'));
        return;
      }
      if (result.error === 'email_already_exists') {
        showError(t('admin.users.email_already_exists', { email: trimmedEmail }));
        return;
      }
      if (result.error) {
        showError(t('admin.users.invite_error', { message: result.message ?? result.error }));
        return;
      }
      if (manualMode) {
        setLastCreated({ email: trimmedEmail, password });
        setEmail('');
        setPassword('');
        setManualMode(false);
        showSuccess(t('admin.users.manual_created_toast', { email: trimmedEmail }));
        onInvited();
        return;
      }
      if (result.status === 'added_to_existing_user') {
        showSuccess(t('admin.users.invite_added_to_existing', { email: trimmedEmail, role }));
      } else {
        showSuccess(t('admin.users.invite_success', { email: trimmedEmail }));
      }
      setEmail('');
      onInvited();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="mb-4 rounded border border-white/10 p-3">
        <h2 className="mb-2 text-sm font-semibold">{t('admin.users.invite_heading')}</h2>
        <label className="mb-3 flex items-center gap-2 text-xs text-white/80">
          <input
            type="checkbox"
            checked={manualMode}
            onChange={(e) => setManualMode(e.target.checked)}
          />
          <span>{t('admin.users.manual_create_toggle')}</span>
        </label>
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
            {busy
              ? t(manualMode ? 'admin.users.manual_submitting' : 'admin.users.invite_sending')
              : t(manualMode ? 'admin.users.manual_submit' : 'admin.users.invite_submit')}
          </button>
        </div>
        {manualMode && (
          <div className="mt-3">
            <label className="block text-xs">
              <span className="block text-white/60">{t('admin.users.manual_password_label')}</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('admin.users.manual_password_placeholder')}
                className="input mt-1"
                aria-label={t('admin.users.manual_password_label')}
              />
            </label>
          </div>
        )}
      </form>
      {lastCreated && (
        <div
          role="status"
          className="mb-4 rounded border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm"
        >
          <p className="font-semibold">{t('admin.users.manual_created_heading')}</p>
          <p className="mt-1 text-white/80">{t('admin.users.manual_created_message')}</p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs">
            <dt className="text-white/60">{t('admin.users.col_email')}:</dt>
            <dd>{lastCreated.email}</dd>
            <dt className="text-white/60">{t('admin.users.manual_password_label')}:</dt>
            <dd>{lastCreated.password}</dd>
          </dl>
          <button
            type="button"
            onClick={() => setLastCreated(null)}
            className="mt-2 text-xs underline text-white/60"
          >
            {t('admin.users.manual_dismiss')}
          </button>
        </div>
      )}
    </>
  );
}
