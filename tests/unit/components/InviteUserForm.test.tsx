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
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } });
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
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'existing@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Einladung senden|Send invitation/i }));
    await waitFor(() => expect(showError).toHaveBeenCalled());
    expect(onInvited).not.toHaveBeenCalled();
  });

  it('shows an error toast on network/server error', async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: { message: 'boom' } });
    render(<InviteUserForm eventId="ev1" onInvited={onInvited} />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Einladung senden|Send invitation/i }));
    await waitFor(() => expect(showError).toHaveBeenCalled());
  });

  it('manual mode submits with password and shows credentials block on success', async () => {
    functionsInvoke.mockResolvedValue({
      data: { ok: true, user_id: 'u1', status: 'manually_created' },
      error: null,
    });
    render(<InviteUserForm eventId="ev1" onInvited={onInvited} />);
    fireEvent.click(screen.getByLabelText(/manuell anlegen|create manually/i));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'helga@kunstmeile.local' } });
    fireEvent.change(screen.getByLabelText('Passwort'), { target: { value: 'sup3rsecret' } });
    fireEvent.click(screen.getByRole('button', { name: /Benutzer anlegen|Create user/i }));
    await waitFor(() => expect(functionsInvoke).toHaveBeenCalled());
    expect(functionsInvoke).toHaveBeenCalledWith('invite-user', {
      body: {
        email: 'helga@kunstmeile.local',
        event_id: 'ev1',
        role_in_event: 'contributor',
        password: 'sup3rsecret',
      },
    });
    await waitFor(() =>
      expect(screen.getByText(/Benutzer angelegt|User created/i)).toBeInTheDocument(),
    );
    expect(screen.getByText('helga@kunstmeile.local')).toBeInTheDocument();
    expect(screen.getByText('sup3rsecret')).toBeInTheDocument();
    expect(onInvited).toHaveBeenCalled();
  });

  it('manual mode rejects a short password without invoking the Edge Function', () => {
    render(<InviteUserForm eventId="ev1" onInvited={onInvited} />);
    fireEvent.click(screen.getByLabelText(/manuell anlegen|create manually/i));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'helga@kunstmeile.local' } });
    fireEvent.change(screen.getByLabelText('Passwort'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: /Benutzer anlegen|Create user/i }));
    expect(functionsInvoke).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalledWith(
      expect.stringMatching(/mindestens 8 Zeichen|at least 8 characters/i),
    );
  });

  it('manual mode surfaces email_already_exists from the Edge Function', async () => {
    functionsInvoke.mockResolvedValue({
      data: { error: 'email_already_exists', message: 'A user with this email address has already been registered' },
      error: null,
    });
    render(<InviteUserForm eventId="ev1" onInvited={onInvited} />);
    fireEvent.click(screen.getByLabelText(/manuell anlegen|create manually/i));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'helga@kunstmeile.local' } });
    fireEvent.change(screen.getByLabelText('Passwort'), { target: { value: 'sup3rsecret' } });
    fireEvent.click(screen.getByRole('button', { name: /Benutzer anlegen|Create user/i }));
    await waitFor(() => expect(showError).toHaveBeenCalled());
    expect(showError).toHaveBeenCalledWith(expect.stringMatching(/already exists|existiert bereits/i));
    expect(screen.queryByText(/Benutzer angelegt|User created/i)).not.toBeInTheDocument();
  });
});
