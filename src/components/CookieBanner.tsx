import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const KEY = 'kunstmeile_cookie_consent';

export function CookieBanner() {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  function onOk() {
    try {
      window.localStorage.setItem(KEY, '1');
    } catch {
      // localStorage may throw in private mode; we still dismiss the banner.
    }
    setDismissed(true);
  }

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-[1200] bg-neutral-950/95 p-4 text-sm text-white backdrop-blur"
    >
      <div className="mx-auto flex max-w-5xl flex-col items-stretch gap-3 md:flex-row md:items-center">
        <p className="flex-1">
          {t('cookie_banner.text')}{' '}
          <Link to="/datenschutz" className="underline">
            {t('cookie_banner.privacy_link')}
          </Link>
        </p>
        <button
          type="button"
          onClick={onOk}
          className="min-h-[44px] w-full rounded bg-white/20 px-5 text-base font-medium hover:bg-white/30 md:w-auto md:min-h-0 md:px-3 md:py-1 md:text-sm md:font-normal"
        >
          {t('cookie_banner.ok')}
        </button>
      </div>
    </div>
  );
}
