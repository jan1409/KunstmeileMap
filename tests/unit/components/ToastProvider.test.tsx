import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from '../../../src/components/ToastProvider';

function Trigger() {
  const { showSuccess, showError } = useToast();
  return (
    <div>
      <button onClick={() => showSuccess('saved')}>trigger-success</button>
      <button onClick={() => showError('oops')}>trigger-error</button>
    </div>
  );
}

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing initially', () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows a status toast for showSuccess and an alert toast for showError', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    await user.click(screen.getByRole('button', { name: /trigger-success/i }));
    expect(screen.getByRole('status')).toHaveTextContent(/saved/i);

    await user.click(screen.getByRole('button', { name: /trigger-error/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/oops/i);
  });

  it('auto-dismisses success after 4 seconds and error after 8 seconds', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    await user.click(screen.getByRole('button', { name: /trigger-success/i }));
    await user.click(screen.getByRole('button', { name: /trigger-error/i }));

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4001);
    });
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('alert')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4001);
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('dismisses immediately when the ✕ button is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    await user.click(screen.getByRole('button', { name: /trigger-error/i }));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('stacks multiple simultaneous toasts', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    await user.click(screen.getByRole('button', { name: /trigger-success/i }));
    await user.click(screen.getByRole('button', { name: /trigger-success/i }));
    await user.click(screen.getByRole('button', { name: /trigger-success/i }));

    expect(screen.getAllByRole('status')).toHaveLength(3);
  });

  it('throws when useToast is called outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Trigger />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});
