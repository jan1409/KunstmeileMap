import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../src/lib/i18n';
import {
  PositionsTentList,
  type PositionsTentListItem,
} from '../../../src/components/PositionsTentList';

function placed(
  id: string,
  name: string,
  num: number | null = null,
): PositionsTentListItem {
  return { id, name, display_number: num };
}

function renderList(props: Partial<React.ComponentProps<typeof PositionsTentList>> = {}) {
  const defaults: React.ComponentProps<typeof PositionsTentList> = {
    placed: [placed('a', 'Alpha', 1), placed('b', 'Bravo', 2)],
    unplaced: [placed('c', 'Charlie', null)],
    dirtyIds: new Set<string>(),
    selectedId: null,
    canEdit: true,
    onSelect: vi.fn(),
    onRevert: vi.fn(),
  };
  return render(
    <I18nextProvider i18n={i18n}>
      <PositionsTentList {...defaults} {...props} />
    </I18nextProvider>,
  );
}

describe('PositionsTentList', () => {
  it('renders both Placed and Unplaced section headers with counts', () => {
    renderList();
    expect(
      screen.getByText(/placed \(2\)|platziert \(2\)/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/not placed \(1\)|nicht platziert \(1\)/i),
    ).toBeInTheDocument();
  });

  it('renders placed rows with #number and name', () => {
    renderList();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Bravo')).toBeInTheDocument();
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
  });

  it('hides the Unplaced section entirely when there are zero unplaced tents', () => {
    renderList({ unplaced: [] });
    expect(screen.queryByText(/not placed|nicht platziert/i)).toBeNull();
  });

  it('shows the empty message when there are zero placed tents', () => {
    renderList({ placed: [] });
    expect(
      screen.getByText(/no tents placed yet|noch keine stände platziert/i),
    ).toBeInTheDocument();
  });

  it('clicking a placed row fires onSelect with the id', async () => {
    const onSelect = vi.fn();
    renderList({ onSelect });
    await userEvent.click(screen.getByRole('button', { name: /alpha/i }));
    expect(onSelect).toHaveBeenCalledWith('a');
  });

  it('renders a revert button only for dirty rows; clicking it fires onRevert and NOT onSelect', async () => {
    const onSelect = vi.fn();
    const onRevert = vi.fn();
    renderList({ dirtyIds: new Set(['a']), onSelect, onRevert });

    // Only one revert button exists (Alpha is dirty, Bravo is not).
    const revertBtns = screen.getAllByRole('button', { name: /revert|zurücksetzen/i });
    expect(revertBtns).toHaveLength(1);

    await userEvent.click(revertBtns[0]!);
    expect(onRevert).toHaveBeenCalledWith('a');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('canEdit=false hides revert buttons even on dirty rows', () => {
    renderList({ dirtyIds: new Set(['a', 'b']), canEdit: false });
    expect(
      screen.queryAllByRole('button', { name: /revert|zurücksetzen/i }),
    ).toHaveLength(0);
  });

  it('selectedId highlights the corresponding row', () => {
    renderList({ selectedId: 'b' });
    const row = screen.getByRole('button', { name: /bravo/i });
    // The selected row gets aria-current="true".
    expect(row).toHaveAttribute('aria-current', 'true');
  });

  it('unplaced rows are not interactive (no onSelect)', async () => {
    const onSelect = vi.fn();
    renderList({ onSelect });
    // Charlie is unplaced. It must NOT render as a button.
    expect(screen.queryByRole('button', { name: /charlie/i })).toBeNull();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });
});

// Silence the unused-import warning if `within` ends up unused.
void within;
