import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../src/lib/i18n';
import { PhotoLightbox } from '../../../src/components/PhotoLightbox';
import type { PhotoItem } from '../../../src/hooks/usePhotos';

const photos: PhotoItem[] = [
  { thumbUrl: 'https://cdn/thumb1.jpg', fullUrl: 'https://cdn/full1.jpg' },
  { thumbUrl: 'https://cdn/thumb2.jpg', fullUrl: 'https://cdn/full2.jpg' },
  { thumbUrl: 'https://cdn/thumb3.jpg', fullUrl: 'https://cdn/full3.jpg' },
];

function renderLightbox(
  props: Partial<React.ComponentProps<typeof PhotoLightbox>> = {},
) {
  const onClose = vi.fn();
  const onIndexChange = vi.fn();
  const utils = render(
    <I18nextProvider i18n={i18n}>
      <PhotoLightbox
        photos={photos}
        index={1}
        onClose={onClose}
        onIndexChange={onIndexChange}
        {...props}
      />
    </I18nextProvider>,
  );
  return { onClose, onIndexChange, ...utils };
}

describe('PhotoLightbox', () => {
  it('renders the full-resolution image for the current index', () => {
    renderLightbox();
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://cdn/full2.jpg');
  });

  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup();
    const { onClose } = renderLightbox();
    await user.click(screen.getByRole('button', { name: /close|schließen/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('advances and rewinds via the next/previous buttons', async () => {
    const user = userEvent.setup();
    const { onIndexChange } = renderLightbox({ index: 1 });
    await user.click(screen.getByRole('button', { name: /next|nächstes|weiter/i }));
    expect(onIndexChange).toHaveBeenCalledWith(2);
    await user.click(screen.getByRole('button', { name: /previous|vorheriges|zurück/i }));
    expect(onIndexChange).toHaveBeenCalledWith(0);
  });

  it('disables previous at the first photo and next at the last', () => {
    const { rerender } = renderLightbox({ index: 0 });
    expect(screen.getByRole('button', { name: /previous|vorheriges|zurück/i })).toBeDisabled();
    rerender(
      <I18nextProvider i18n={i18n}>
        <PhotoLightbox
          photos={photos}
          index={2}
          onClose={() => {}}
          onIndexChange={() => {}}
        />
      </I18nextProvider>,
    );
    expect(screen.getByRole('button', { name: /next|nächstes|weiter/i })).toBeDisabled();
  });

  it('closes on Escape and navigates with arrow keys', () => {
    const { onClose, onIndexChange } = renderLightbox({ index: 1 });
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(onIndexChange).toHaveBeenCalledWith(2);
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(onIndexChange).toHaveBeenCalledWith(0);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('hides navigation controls when there is only one photo', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <PhotoLightbox
          photos={[photos[0]!]}
          index={0}
          onClose={() => {}}
          onIndexChange={() => {}}
        />
      </I18nextProvider>,
    );
    expect(screen.queryByRole('button', { name: /next|nächstes|weiter/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /previous|vorheriges|zurück/i })).toBeNull();
  });

  it('closes when the backdrop is clicked but not when the image is clicked', async () => {
    const user = userEvent.setup();
    const { onClose } = renderLightbox();
    await user.click(screen.getByRole('img'));
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByTestId('lightbox-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
