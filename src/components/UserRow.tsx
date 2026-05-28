import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { EventUser } from '../hooks/useEventUsers';

type Role = 'owner' | 'editor' | 'contributor';

interface Props {
  user: EventUser;
  isSelf: boolean;
  onChangeRole: (profileId: string, newRole: Role) => void;
  onRemove: (profileId: string) => void;
  onResendInvite: (email: string, currentRole: Role) => void;
}

export function UserRow({ user, isSelf, onChangeRole, onRemove, onResendInvite }: Props) {
  const { t } = useTranslation();
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const isPending = user.emailConfirmedAt == null;

  return (
    <tr className="border-b border-white/5">
      <td className="py-2">
        {isPending && <span className="mr-1 text-white/50">{t('admin.users.pending_prefix')}</span>}
        {user.email}
      </td>
      <td>
        {isSelf ? (
          <span className="text-white/60">{t(`admin.users.role_${user.roleInEvent}`)}</span>
        ) : (
          <select
            aria-label={t('admin.users.col_role')}
            value={user.roleInEvent}
            onChange={(e) => onChangeRole(user.profileId, e.target.value as 'owner' | 'editor' | 'contributor')}
            className="input"
          >
            <option value="contributor">{t('admin.users.role_contributor')}</option>
            <option value="editor">{t('admin.users.role_editor')}</option>
            <option value="owner">{t('admin.users.role_owner')}</option>
          </select>
        )}
      </td>
      <td className="space-x-3">
        {isSelf ? (
          <span className="text-white/60">{t('admin.users.you_label')}</span>
        ) : (
          <>
            {isPending && (
              <button
                type="button"
                onClick={() => onResendInvite(user.email, user.roleInEvent)}
                className="underline"
              >
                {t('admin.users.action_resend_invite')}
              </button>
            )}
            {confirmingRemove ? (
              <button
                type="button"
                onClick={() => {
                  onRemove(user.profileId);
                  setConfirmingRemove(false);
                }}
                className="text-red-400"
              >
                {t('admin.users.action_confirm_remove')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingRemove(true)}
                className="text-red-400"
              >
                {t('admin.users.action_remove')}
              </button>
            )}
          </>
        )}
      </td>
    </tr>
  );
}
