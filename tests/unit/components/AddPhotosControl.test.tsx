import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../src/lib/i18n';

const { uploadFn, insertPhoto, countHead } = vi.hoisted(() => ({
  uploadFn: vi.fn(),
  insertPhoto: vi.fn(),
  countHead: vi.fn(),
}));

vi.mock('../../../src/lib/supabase', () => {
  // tent_photos chain for count: from('tent_photos').select('id', { head: true, count: 'exact' }).eq('tent_id', x)
  // The select call must accept the options object as a second arg.
  const headEq = vi.fn().mockImplementation(async () => countHead());
  const headSelect = vi.fn().mockReturnValue({ eq: headEq });
  // Same chain also handles insert: from('tent_photos').insert({...})
  const fromTable = {
    select: headSelect,
    insert: insertPhoto,
  };
  // storage chain: storage.from('tent-photos').upload
  const storageBucket = { upload: uploadFn };
  return {
    supabase: {
      from: vi.fn().mockReturnValue(fromTable),
      storage: { from: vi.fn().mockReturnValue(storageBucket) },
    },
  };
});

const { showError, showSuccess } = vi.hoisted(() => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

vi.mock('../../../src/components/ToastProvider', () => ({
  useToast: () => ({ showError, showSuccess }),
}));

import { AddPhotosControl } from '../../../src/components/AddPhotosControl';

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

describe('AddPhotosControl', () => {
  beforeEach(() => {
    uploadFn.mockReset();
    insertPhoto.mockReset();
    countHead.mockReset();
    showError.mockReset();
    showSuccess.mockReset();

    countHead.mockResolvedValue({ count: 0, error: null });
    uploadFn.mockResolvedValue({ data: null, error: null });
    insertPhoto.mockResolvedValue({ data: null, error: null });
  });

  it('renders an "Add photo" button with hidden file input', () => {
    renderWithI18n(<AddPhotosControl eventId="evt-1" tentId="tent-1" onUploaded={() => {}} />);
    expect(screen.getByRole('button', { name: /add photo|foto hinzufügen/i })).toBeInTheDocument();
  });

  it('uploads the chosen file, inserts a row, and calls onUploaded', async () => {
    const onUploaded = vi.fn();
    const user = userEvent.setup();
    renderWithI18n(<AddPhotosControl eventId="evt-1" tentId="tent-1" onUploaded={onUploaded} />);

    const file = new File(['png'], 'photo.png', { type: 'image/png' });
    const input = screen.getByTestId('add-photo-input') as HTMLInputElement;
    await user.upload(input, file);

    await waitFor(() => expect(uploadFn).toHaveBeenCalledTimes(1));
    const [path, uploaded] = uploadFn.mock.calls[0]!;
    expect(path).toMatch(/^evt-1\/tent-1\/[0-9a-f-]+\.png$/);
    expect(uploaded).toBe(file);

    expect(insertPhoto).toHaveBeenCalledTimes(1);
    const row = insertPhoto.mock.calls[0]![0];
    expect(row.tent_id).toBe('tent-1');
    expect(row.storage_path).toBe(path);
    expect(row.display_order).toBe(0);

    expect(onUploaded).toHaveBeenCalledTimes(1);
  });

  it('shows an error toast and does NOT insert when upload fails (e.g. RLS rejection)', async () => {
    uploadFn.mockResolvedValue({ data: null, error: { message: 'permission denied' } });
    const onUploaded = vi.fn();
    const user = userEvent.setup();
    renderWithI18n(<AddPhotosControl eventId="evt-1" tentId="tent-1" onUploaded={onUploaded} />);

    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByTestId('add-photo-input') as HTMLInputElement, file);

    await waitFor(() => expect(showError).toHaveBeenCalledTimes(1));
    expect(showError.mock.calls[0]![0]).toMatch(/permission denied/i);
    expect(insertPhoto).not.toHaveBeenCalled();
    expect(onUploaded).not.toHaveBeenCalled();
  });
});
