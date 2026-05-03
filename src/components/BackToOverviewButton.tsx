import { useTranslation } from 'react-i18next';

interface Props {
  visible: boolean;
  onClick: () => void;
  /**
   * When true, the button shifts to a position that doesn't overlap the
   * SidePanel: above the panel's top edge on mobile, left of the panel's
   * left edge on desktop. When false, the button uses the default
   * bottom-right placement.
   */
  panelOpen?: boolean;
}

/**
 * Floating "↩ Back to overview" button rendered bottom-right on the public
 * viewer. Visible iff the camera has moved away from the per-event saved
 * default. Clicking flies back to the saved default (handled by the parent).
 */
export function BackToOverviewButton({ visible, onClick, panelOpen = false }: Props) {
  const { t } = useTranslation();
  if (!visible) return null;
  const position = panelOpen
    ? 'bottom-[calc(33vh+0.5rem)] right-4 md:bottom-12 md:right-[calc(400px+1rem)]'
    : 'bottom-12 right-4';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`fixed z-40 rounded bg-white/10 px-3 py-2 text-xs text-white shadow-lg backdrop-blur hover:bg-white/20 ${position}`}
    >
      <span aria-hidden="true">↩</span> {t('viewer.back_to_overview')}
    </button>
  );
}
