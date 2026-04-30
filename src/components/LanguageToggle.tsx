import { useTranslation } from 'react-i18next';

export function LanguageToggle() {
  const { i18n } = useTranslation();
  const current = i18n.language?.startsWith('en') ? 'en' : 'de';
  return (
    <div className="flex items-center gap-1 text-xs">
      {(['de', 'en'] as const).map((lng) => (
        <button
          key={lng}
          onClick={() => void i18n.changeLanguage(lng)}
          aria-label={`Switch to ${lng.toUpperCase()}`}
          className={`rounded px-2 py-1 ${
            current === lng ? 'bg-white/20' : 'hover:bg-white/10'
          }`}
        >
          {lng.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
