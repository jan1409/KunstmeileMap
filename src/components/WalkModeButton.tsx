import { useTranslation } from 'react-i18next';

interface Props {
  active: boolean;
  onToggle: () => void;
  /**
   * When true, the button shifts to a position that doesn't overlap the
   * SidePanel's close (✕) button on desktop. Mobile is unaffected (panel
   * is at the bottom, so no top-right conflict).
   */
  panelOpen?: boolean;
}

/**
 * Floating "🚶 Walk" toggle in the top-right of the public viewer. Clicking
 * toggles walk mode on/off — the parent owns the boolean state and the
 * controller lifecycle. The button's pressed state (aria-pressed) reflects
 * `active`.
 */
export function WalkModeButton({ active, onToggle, panelOpen = false }: Props) {
  const { t } = useTranslation();
  const position = panelOpen
    ? 'right-4 top-3 md:right-[calc(400px+1rem)] md:top-4'
    : 'right-4 top-3 md:top-4';
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`fixed z-40 rounded px-3 py-2 text-xs text-white shadow-lg backdrop-blur transition-colors ${
        active ? 'bg-white/30 hover:bg-white/40' : 'bg-white/10 hover:bg-white/20'
      } ${position}`}
    >
      <span aria-hidden="true">🚶</span> {t('viewer.walk_enter')}
    </button>
  );
}
