import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import deCommon from '../locales/de/common.json';
import enCommon from '../locales/en/common.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      de: { common: deCommon },
      en: { common: enCommon },
    },
    fallbackLng: 'de',
    defaultNS: 'common',
    ns: ['common'],
    interpolation: { escapeValue: false },
    detection: {
      // Order is deliberate: explicit user choices first, then fall through to
      // `fallbackLng: 'de'` rather than the browser's navigator language. The
      // Kunstmeile audience is German-speaking by default; English browsers
      // can switch via the LanguageToggle (public TopBar + AdminLayout
      // header) or via the `?lang=en` querystring.
      order: ['localStorage', 'querystring'],
      lookupQuerystring: 'lang',
      lookupLocalStorage: 'kunstmeile_lang',
      caches: ['localStorage'],
    },
  });

export default i18n;
