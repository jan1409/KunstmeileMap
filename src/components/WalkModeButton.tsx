import { useTranslation } from 'react-i18next';

interface Props {
  active: boolean;
  onToggle: () => void;
}

/**
 * Floating "🚶 Walk" toggle in the top-right of the public viewer. Clicking
 * toggles walk mode on/off — the parent owns the boolean state and the
 * controller lifecycle. The button's pressed state (aria-pressed) reflects
 * `active`.
 */
export function WalkModeButton({ active, onToggle }: Props) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`fixed right-4 top-3 z-40 rounded px-3 py-2 text-xs text-white shadow-lg backdrop-blur transition-colors ${
        active ? 'bg-white/30 hover:bg-white/40' : 'bg-white/10 hover:bg-white/20'
      } md:top-4`}
    >
      <span aria-hidden="true">🚶</span> {t('viewer.walk_enter')}
    </button>
  );
}
