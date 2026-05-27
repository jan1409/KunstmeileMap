import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useEvent } from '../../hooks/useEvent';
import { useEventUsers } from '../../hooks/useEventUsers';
import { useAuth } from '../../components/AuthProvider';
import { useToast } from '../../components/ToastProvider';
import { InviteUserForm } from '../../components/InviteUserForm';
import { UserRow } from '../../components/UserRow';

type Role = 'contributor' | 'editor' | 'owner';

export default function UsersPage() {
  const { t } = useTranslation();
  const { eventSlug } = useParams();
  const { event } = useEvent(eventSlug);
  const { users, loading, refetch } = useEventUsers(event?.id);
  const { session } = useAuth();
  const { showSuccess, showError } = useToast();

  if (!event) return <p className="p-6">…</p>;

  const myProfileId = session?.user?.id ?? null;
  const onlySelf = users.length === 1 && users[0]?.profileId === myProfileId;

  async function onChangeRole(profileId: string, newRole: Role) {
    if (!event) return;
    const { error } = await supabase
      .from('event_admins')
      .update({ role_in_event: newRole })
      .eq('event_id', event.id)
      .eq('profile_id', profileId);
    if (error) {
      showError(`Update failed: ${error.message}`);
      return;
    }
    refetch();
  }

  async function onRemove(profileId: string) {
    if (!event) return;
    const { error } = await supabase
      .from('event_admins')
      .delete()
      .eq('event_id', event.id)
      .eq('profile_id', profileId);
    if (error) {
      showError(`Remove failed: ${error.message}`);
      return;
    }
    refetch();
  }

  async function onResendInvite(email: string) {
    if (!event) return;
    const { data, error } = await supabase.functions.invoke('invite-user', {
      body: { email, event_id: event.id, role_in_event: 'contributor', resend: true },
    });
    const r = (data ?? {}) as { error?: string; message?: string };
    if (error || r.error) {
      showError(`Resend failed: ${error?.message ?? r.message ?? r.error}`);
      return;
    }
    showSuccess(t('admin.users.invite_success', { email }));
  }

  return (
    <div>
      <h1 className="mb-3 text-2xl font-semibold">
        {t('admin.users.heading', { title: event.title_de })}
      </h1>

      <InviteUserForm eventId={event.id} onInvited={refetch} />

      <h2 className="mb-2 text-sm font-semibold text-white/80">{t('admin.users.list_heading')}</h2>

      {loading ? (
        <p>…</p>
      ) : (
        <>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 text-xs text-white/60">
              <tr>
                <th className="py-2">{t('admin.users.col_email')}</th>
                <th>{t('admin.users.col_role')}</th>
                <th>{t('admin.users.col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <UserRow
                  key={u.profileId}
                  user={u}
                  isSelf={u.profileId === myProfileId}
                  onChangeRole={onChangeRole}
                  onRemove={onRemove}
                  onResendInvite={onResendInvite}
                />
              ))}
            </tbody>
          </table>
          {onlySelf && (
            <p className="mt-3 text-sm text-white/60">{t('admin.users.empty')}</p>
          )}
        </>
      )}
    </div>
  );
}
