import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as XLSX from 'xlsx';

import '../../../src/lib/i18n';

const { upsertCat, listEq, showSuccess, showError } = vi.hoisted(() => ({
  upsertCat: vi.fn(),
  listEq: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

vi.mock('../../../src/lib/supabase', () => {
  // CategoryImportModal does:
  //   - supabase.from('categories').select('*').eq('event_id', X)   (existing-slug lookup)
  //   - supabase.from('categories').upsert([...], { onConflict })   (commit)
  const select = vi.fn().mockReturnValue({ eq: listEq });
  return {
    supabase: {
      from: vi.fn().mockReturnValue({
        select,
        upsert: upsertCat,
      }),
    },
  };
});

vi.mock('../../../src/components/ToastProvider', () => ({
  useToast: () => ({ showSuccess, showError }),
}));

import { CategoryImportModal } from '../../../src/components/CategoryImportModal';

function makeXlsxFile(aoa: unknown[][], name = 'cats.xlsx'): File {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Categories');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new File([buf], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

const existingGalerie = {
  id: 'c1',
  event_id: 'evt-1',
  slug: 'galerie',
  name_de: 'Galerie',
  name_en: 'Gallery',
  icon: '🎨',
  display_order: 0,
};

describe('CategoryImportModal', () => {
  // Note: typed as Mock so .toHaveBeenCalledTimes lines up; cast at the
  // prop site to satisfy the `() => void` shape on the component props.
  let onClose: ReturnType<typeof vi.fn>;
  let onImported: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    upsertCat.mockReset();
    listEq.mockReset();
    showSuccess.mockReset();
    showError.mockReset();
    onClose = vi.fn();
    onImported = vi.fn();
    upsertCat.mockResolvedValue({ data: null, error: null });
    // Default: one existing category named 'galerie' so the same-slug row
    // shows up as `update` and a new slug shows up as `new`.
    listEq.mockResolvedValue({ data: [existingGalerie], error: null });
  });

  it('renders the file picker when open', () => {
    render(
      <CategoryImportModal
        eventId="evt-1"
        open={true}
        onClose={onClose as () => void}
        onImported={onImported as () => void}
      />,
    );
    expect(
      screen.getByText(/import categories|Kategorien importieren/i),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/choose xlsx|XLSX- oder CSV/i),
    ).toBeInTheDocument();
  });

  it('does not render when open=false', () => {
    render(
      <CategoryImportModal
        eventId="evt-1"
        open={false}
        onClose={onClose as () => void}
        onImported={onImported as () => void}
      />,
    );
    expect(
      screen.queryByText(/import categories|Kategorien importieren/i),
    ).not.toBeInTheDocument();
  });

  it('disables the Import button until a file is parsed', () => {
    render(
      <CategoryImportModal
        eventId="evt-1"
        open={true}
        onClose={onClose as () => void}
        onImported={onImported as () => void}
      />,
    );
    const importBtn = screen.getByRole('button', { name: /^import$|^Importieren$/i });
    expect(importBtn).toBeDisabled();
  });

  it('shows a preview with per-row status (new vs update) after parsing', async () => {
    const user = userEvent.setup();
    render(
      <CategoryImportModal
        eventId="evt-1"
        open={true}
        onClose={onClose as () => void}
        onImported={onImported as () => void}
      />,
    );

    // Give the existing-categories fetch a tick to resolve.
    await waitFor(() => expect(listEq).toHaveBeenCalled());

    const file = makeXlsxFile([
      ['slug', 'name_de', 'name_en', 'icon', 'display_order'],
      ['galerie', 'Galerie', 'Gallery', '🎨', 0], // matches existing → update
      ['food', 'Essen', 'Food', '🍞', 2],         // new
    ]);

    const input = screen.getByLabelText(/choose xlsx|XLSX- oder CSV/i) as HTMLInputElement;
    await user.upload(input, file);

    await screen.findByText(/preview|Vorschau/i);
    expect(screen.getByText(/^update$|^Aktualisieren$/i)).toBeInTheDocument();
    expect(screen.getByText(/^new$|^Neu$/i)).toBeInTheDocument();
  });

  it('upserts valid rows with the right payload and onConflict on commit', async () => {
    const user = userEvent.setup();
    render(
      <CategoryImportModal
        eventId="evt-1"
        open={true}
        onClose={onClose as () => void}
        onImported={onImported as () => void}
      />,
    );

    await waitFor(() => expect(listEq).toHaveBeenCalled());

    const file = makeXlsxFile([
      ['slug', 'name_de', 'name_en', 'icon', 'display_order'],
      ['galerie', 'Galerie', 'Gallery', '🎨', 0],
      ['food', 'Essen', 'Food', '🍞', 2],
    ]);
    const input = screen.getByLabelText(/choose xlsx|XLSX- oder CSV/i) as HTMLInputElement;
    await user.upload(input, file);

    await screen.findByText(/preview|Vorschau/i);
    await user.click(
      screen.getByRole('button', { name: /^import$|^Importieren$/i }),
    );

    await waitFor(() => expect(upsertCat).toHaveBeenCalledTimes(1));
    const [payload, opts] = upsertCat.mock.calls[0]!;
    expect(opts).toMatchObject({ onConflict: 'event_id,slug' });
    expect(Array.isArray(payload)).toBe(true);
    expect(payload).toHaveLength(2);
    // Every row carries event_id so the upsert lands in the right event.
    for (const row of payload as Array<Record<string, unknown>>) {
      expect(row.event_id).toBe('evt-1');
    }
    expect(payload[0]).toMatchObject({
      event_id: 'evt-1',
      slug: 'galerie',
      name_de: 'Galerie',
      name_en: 'Gallery',
      icon: '🎨',
      display_order: 0,
    });
    expect(payload[1]).toMatchObject({
      event_id: 'evt-1',
      slug: 'food',
      name_de: 'Essen',
      name_en: 'Food',
      icon: '🍞',
      display_order: 2,
    });

    await waitFor(() => expect(showSuccess).toHaveBeenCalled());
    expect(onImported).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('skips invalid rows but still commits the valid ones', async () => {
    const user = userEvent.setup();
    render(
      <CategoryImportModal
        eventId="evt-1"
        open={true}
        onClose={onClose as () => void}
        onImported={onImported as () => void}
      />,
    );

    await waitFor(() => expect(listEq).toHaveBeenCalled());

    const file = makeXlsxFile([
      ['slug', 'name_de', 'name_en', 'icon', 'display_order'],
      ['Bad Slug!', 'X', '', '', 0], // invalid slug → error
      ['food', 'Essen', 'Food', '🍞', 2], // ok
    ]);
    const input = screen.getByLabelText(/choose xlsx|XLSX- oder CSV/i) as HTMLInputElement;
    await user.upload(input, file);

    await screen.findByText(/preview|Vorschau/i);
    await user.click(
      screen.getByRole('button', { name: /^import$|^Importieren$/i }),
    );

    await waitFor(() => expect(upsertCat).toHaveBeenCalledTimes(1));
    const [payload] = upsertCat.mock.calls[0]!;
    expect(payload).toHaveLength(1);
    expect((payload as Array<Record<string, unknown>>)[0]!.slug).toBe('food');
  });
});
