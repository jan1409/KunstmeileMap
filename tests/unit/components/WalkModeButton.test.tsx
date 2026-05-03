import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../src/lib/i18n';
import { WalkModeButton } from '../../../src/components/WalkModeButton';

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

describe('WalkModeButton', () => {
  it('renders with the localized "enter walk" label when active=false', () => {
    renderWithI18n(<WalkModeButton active={false} onToggle={() => {}} />);
    expect(
      screen.getByRole('button', { name: /walk|spaziergang/i }),
    ).toBeInTheDocument();
  });

  it('calls onToggle when clicked', async () => {
    const onToggle = vi.fn();
    renderWithI18n(<WalkModeButton active={false} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('marks the button as pressed (aria-pressed) when active=true', () => {
    renderWithI18n(<WalkModeButton active={true} onToggle={() => {}} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });
});
