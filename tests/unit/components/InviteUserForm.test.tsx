import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '../../../src/lib/i18n';
import { InviteUserForm } from '../../../src/components/InviteUserForm';

const functionsInvoke = vi.fn();
vi.mock('../../../src/lib/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => functionsInvoke(...args) } },
}));

const showSuccess = vi.fn();
const showError = vi.fn();
vi.mock('../../../src/components/ToastProvider', () => ({
  useToast: () => ({ showSuccess, showError }),
}));

describe('InviteUserForm', () => {
  let onInvited: ReturnType<typeof vi.fn> & (() => void);
  beforeEach(() => {
    functionsInvoke.mockReset();
    showSuccess.mockReset();
    showError.mockReset();
    onInvited = vi.fn() as typeof onInvited;
  });

  it('does not submit when email is empty', () => {
    render(<InviteUserForm eventId="ev1" onInvited={onInvited} />);
    fireEvent.click(screen.getByRole('button', { name: /Einladung senden|Send invitation/i }));
    expect(functionsInvoke).not.toHaveBeenCalled();
  });

  it('calls the Edge Function with email + event_id + role_in_event on submit', async () => {
    functionsInvoke.mockResolvedValue({ data: { ok: true, user_id: 'new-uid', status: 'invited' }, error: null });
    render(<InviteUserForm eventId="ev1" onInvited={onInvited} />);
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'new@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Einladung senden|Send invitation/i }));
    await waitFor(() => expect(functionsInvoke).toHaveBeenCalled());
    expect(functionsInvoke).toHaveBeenCalledWith('invite-user', {
      body: { email: 'new@example.com', event_id: 'ev1', role_in_event: 'contributor' },
    });
    await waitFor(() => expect(showSuccess).toHaveBeenCalled());
    expect(onInvited).toHaveBeenCalled();
  });

  it('shows an error toast when the Edge Function returns already_member', async () => {
    functionsInvoke.mockResolvedValue({ data: { error: 'already_member', existing_role: 'editor' }, error: null });
    render(<InviteUserForm eventId="ev1" onInvited={onInvited} />);
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'existing@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Einladung senden|Send invitation/i }));
    await waitFor(() => expect(showError).toHaveBeenCalled());
    expect(onInvited).not.toHaveBeenCalled();
  });

  it('shows an error toast on network/server error', async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: { message: 'boom' } });
    render(<InviteUserForm eventId="ev1" onInvited={onInvited} />);
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'new@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Einladung senden|Send invitation/i }));
    await waitFor(() => expect(showError).toHaveBeenCalled());
  });
});
