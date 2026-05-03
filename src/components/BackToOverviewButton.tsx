import { useTranslation } from 'react-i18next';

interface Props {
  visible: boolean;
  onClick: () => void;
}

/**
 * Floating "↩ Back to overview" button rendered bottom-right on the public
 * viewer. Visible iff the camera has moved away from the per-event saved
 * default. Clicking flies back to the saved default (handled by the parent).
 */
export function BackToOverviewButton({ visible, onClick }: Props) {
  const { t } = useTranslation();
  if (!visible) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-12 right-4 z-30 rounded bg-white/10 px-3 py-2 text-xs text-white shadow-lg backdrop-blur hover:bg-white/20"
    >
      ↩ {t('viewer.back_to_overview')}
    </button>
  );
}
