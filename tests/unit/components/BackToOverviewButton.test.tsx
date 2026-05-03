import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../src/lib/i18n';
import { BackToOverviewButton } from '../../../src/components/BackToOverviewButton';

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

describe('BackToOverviewButton', () => {
  it('renders nothing when not visible', () => {
    const { container } = renderWithI18n(
      <BackToOverviewButton visible={false} onClick={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders a button with the localized label when visible', () => {
    renderWithI18n(<BackToOverviewButton visible={true} onClick={() => {}} />);
    expect(screen.getByRole('button', { name: /back to overview|zurück zur übersicht/i })).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    renderWithI18n(<BackToOverviewButton visible={true} onClick={onClick} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
