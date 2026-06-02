import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '../hooks/useFocusTrap';
import type { PhotoItem } from '../hooks/usePhotos';

interface Props {
  photos: PhotoItem[];
  /** Index into `photos` of the currently shown image. */
  index: number;
  onClose: () => void;
  onIndexChange: (next: number) => void;
}

/** Minimum horizontal travel (px) to register a swipe as prev/next. */
const SWIPE_THRESHOLD = 50;

/**
 * Full-screen photo viewer. Centers the original-resolution image over a dark
 * backdrop with a close (✕) control, optional prev/next navigation, keyboard
 * support (Esc / ←/→) and touch swipe. Sits above the SidePanel (z-[1100]).
 * Reuses the modal idiom from CategoryImportModal: backdrop + useFocusTrap.
 *
 * Rendered through a portal to `document.body` so `position: fixed` resolves
 * against the viewport. Its host (SidePanel) uses `backdrop-blur`, which makes
 * the panel a containing block for fixed descendants — without the portal the
 * lightbox would be clipped to the panel instead of filling the window.
 */
export function PhotoLightbox({ photos, index, onClose, onIndexChange }: Props) {
  const { t } = useTranslation();
  const trapRef = useFocusTrap<HTMLDivElement>(true);
  const touchStartX = useRef<number | null>(null);

  const count = photos.length;
  const hasPrev = index > 0;
  const hasNext = index < count - 1;
  const current = photos[index];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && index > 0) onIndexChange(index - 1);
      else if (e.key === 'ArrowRight' && index < count - 1)
        onIndexChange(index + 1);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, count, onClose, onIndexChange]);

  if (!current) return null;

  function onTouchEnd(e: React.TouchEvent) {
    const startX = touchStartX.current;
    touchStartX.current = null;
    if (startX == null) return;
    const dx = e.changedTouches[0]!.clientX - startX;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    if (dx > 0 && hasPrev) onIndexChange(index - 1);
    else if (dx < 0 && hasNext) onIndexChange(index + 1);
  }

  return createPortal(
    <div
      ref={trapRef}
      role="dialog"
      aria-modal="true"
      aria-label={t('lightbox.image_alt')}
      data-testid="lightbox-backdrop"
      // Close only when the backdrop itself (not a child) is clicked.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0]!.clientX;
      }}
      onTouchEnd={onTouchEnd}
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/90 p-4"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t('lightbox.close')}
        className="absolute right-4 top-4 rounded p-2 text-2xl leading-none text-white/80 hover:bg-white/10 hover:text-white"
      >
        ✕
      </button>

      {count > 1 && (
        <button
          type="button"
          onClick={() => hasPrev && onIndexChange(index - 1)}
          disabled={!hasPrev}
          aria-label={t('lightbox.previous')}
          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full p-3 text-3xl leading-none text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-30 md:left-4"
        >
          ‹
        </button>
      )}

      <img
        src={current.fullUrl}
        alt={t('lightbox.image_alt')}
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full object-contain"
      />

      {count > 1 && (
        <button
          type="button"
          onClick={() => hasNext && onIndexChange(index + 1)}
          disabled={!hasNext}
          aria-label={t('lightbox.next')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-3 text-3xl leading-none text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-30 md:right-4"
        >
          ›
        </button>
      )}
    </div>,
    document.body,
  );
}
