import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '../../../src/lib/i18n';
import { UserRow } from '../../../src/components/UserRow';
import type { EventUser } from '../../../src/hooks/useEventUsers';

const sampleUser: EventUser = {
  profileId: 'p-1',
  email: 'helga@example.com',
  fullName: 'Helga',
  roleInEvent: 'editor',
  emailConfirmedAt: '2026-05-20T10:00:00Z',
  invitedAt: '2026-05-19T10:00:00Z',
};

describe('UserRow', () => {
  let onChangeRole: ReturnType<typeof vi.fn> & ((profileId: string, newRole: 'owner' | 'editor' | 'contributor') => void);
  let onRemove: ReturnType<typeof vi.fn> & ((profileId: string) => void);
  let onResendInvite: ReturnType<typeof vi.fn> & ((email: string) => void);
  beforeEach(() => {
    onChangeRole = vi.fn() as typeof onChangeRole;
    onRemove = vi.fn() as typeof onRemove;
    onResendInvite = vi.fn() as typeof onResendInvite;
  });

  it('renders email and current role', () => {
    render(
      <table><tbody>
        <UserRow user={sampleUser} isSelf={false} onChangeRole={onChangeRole} onRemove={onRemove} onResendInvite={onResendInvite} />
      </tbody></table>,
    );
    expect(screen.getByText('helga@example.com')).toBeInTheDocument();
  });

  it('shows the "you" label and disables actions when isSelf=true', () => {
    render(
      <table><tbody>
        <UserRow user={sampleUser} isSelf={true} onChangeRole={onChangeRole} onRemove={onRemove} onResendInvite={onResendInvite} />
      </tbody></table>,
    );
    expect(screen.getByText(/Du selbst|You/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Entfernen|Remove/i })).not.toBeInTheDocument();
  });

  it('calls onChangeRole when the dropdown value changes', () => {
    render(
      <table><tbody>
        <UserRow user={sampleUser} isSelf={false} onChangeRole={onChangeRole} onRemove={onRemove} onResendInvite={onResendInvite} />
      </tbody></table>,
    );
    fireEvent.change(screen.getByRole('combobox', { name: /Rolle|Role/i }), { target: { value: 'contributor' } });
    expect(onChangeRole).toHaveBeenCalledWith('p-1', 'contributor');
  });

  it('uses a two-click confirm pattern for remove', () => {
    render(
      <table><tbody>
        <UserRow user={sampleUser} isSelf={false} onChangeRole={onChangeRole} onRemove={onRemove} onResendInvite={onResendInvite} />
      </tbody></table>,
    );
    // First click: shifts to confirm state, does NOT call onRemove yet.
    fireEvent.click(screen.getByRole('button', { name: /Entfernen|Remove/i }));
    expect(onRemove).not.toHaveBeenCalled();
    // Second click on the confirm button: invokes onRemove.
    fireEvent.click(screen.getByRole('button', { name: /Klick zum Bestätigen|Click to confirm/i }));
    expect(onRemove).toHaveBeenCalledWith('p-1');
  });

  it('shows "(Pending)" + "Resend" for unconfirmed users', () => {
    const pending: EventUser = { ...sampleUser, emailConfirmedAt: null };
    render(
      <table><tbody>
        <UserRow user={pending} isSelf={false} onChangeRole={onChangeRole} onRemove={onRemove} onResendInvite={onResendInvite} />
      </tbody></table>,
    );
    expect(screen.getByText(/\(Pending\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Erneut senden|Resend/i }));
    expect(onResendInvite).toHaveBeenCalledWith('helga@example.com');
  });
});
