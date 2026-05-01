import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useFocusTrap } from '../../../src/hooks/useFocusTrap';

function Fixture({ active }: { active: boolean }) {
  const ref = useFocusTrap<HTMLDivElement>(active);
  return (
    <div>
      <button>before</button>
      <div ref={ref} tabIndex={-1} data-testid="trap">
        <button>first</button>
        <input aria-label="middle" />
        <button>last</button>
      </div>
      <button>after</button>
    </div>
  );
}

describe('useFocusTrap', () => {
  it('focuses the first focusable element on activation', () => {
    render(<Fixture active />);
    expect(screen.getByRole('button', { name: 'first' })).toHaveFocus();
  });

  it('cycles forward Tab past the last element back to the first', async () => {
    const user = userEvent.setup();
    render(<Fixture active />);

    expect(screen.getByRole('button', { name: 'first' })).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('middle')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'last' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'first' })).toHaveFocus();
  });

  it('cycles Shift+Tab from the first element back to the last', async () => {
    const user = userEvent.setup();
    render(<Fixture active />);

    expect(screen.getByRole('button', { name: 'first' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'last' })).toHaveFocus();
  });

  it('does nothing when active is false', async () => {
    const user = userEvent.setup();
    render(<Fixture active={false} />);

    expect(screen.getByRole('button', { name: 'first' })).not.toHaveFocus();

    // Default tab order: starts at the first focusable in the document.
    await user.tab();
    expect(screen.getByRole('button', { name: 'before' })).toHaveFocus();
  });

  it('restores focus to the previously-focused element on unmount', () => {
    const Outer = ({ open }: { open: boolean }) => (
      <div>
        <button data-testid="opener">opener</button>
        {open && <Fixture active />}
      </div>
    );
    const { rerender } = render(<Outer open={false} />);
    const opener = screen.getByTestId('opener');
    opener.focus();
    expect(opener).toHaveFocus();

    rerender(<Outer open />);
    expect(screen.getByRole('button', { name: 'first' })).toHaveFocus();

    rerender(<Outer open={false} />);
    expect(opener).toHaveFocus();
  });
});
