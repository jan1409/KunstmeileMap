import { useTranslation } from 'react-i18next';
import type { Tent, Category } from '../lib/supabase';

interface Props {
  tent: Tent | null;
  category: Category | null;
  photoUrls: string[];
  onClose: () => void;
  onShare?: () => void;
}

export function SidePanel({ tent, category, photoUrls, onClose, onShare }: Props) {
  const { t, i18n } = useTranslation();
  if (!tent) return null;

  const lang = i18n.language as 'de' | 'en';
  const description =
    (lang === 'de' ? tent.description_de : tent.description_en) || tent.description_de;
  const categoryName =
    (category && (lang === 'de' ? category.name_de : category.name_en)) || category?.name_de;

  return (
    <aside
      role="dialog"
      aria-label={tent.name}
      className="fixed bottom-0 right-0 z-30 flex h-[60vh] w-full flex-col overflow-y-auto bg-neutral-900/95 p-6 text-white shadow-2xl backdrop-blur-md md:top-0 md:h-full md:w-[400px] md:rounded-l-lg"
    >
      {/* Mobile drag handle */}
      <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-white/30 md:hidden" />

      <button
        onClick={onClose}
        aria-label={t('side_panel.close')}
        className="absolute right-4 top-4 rounded p-2 text-white/70 hover:bg-white/10 hover:text-white"
      >
        ✕
      </button>

      <h2 className="pr-8 text-2xl font-semibold">{tent.name}</h2>

      {category && (
        <p className="mt-1 text-sm text-white/60">
          {category.icon} {categoryName ?? category.name_de}
        </p>
      )}

      {photoUrls.length > 0 && (
        <div className="mt-4 -mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2">
          {photoUrls.map((url, i) => (
            <img
              key={url}
              src={url}
              alt=""
              loading={i === 0 ? 'eager' : 'lazy'}
              className="h-40 snap-start rounded shadow-md"
            />
          ))}
        </div>
      )}

      {description && (
        <p className="mt-4 whitespace-pre-line text-sm leading-relaxed">{description}</p>
      )}

      {tent.address && (
        <p className="mt-4 text-sm">
          <span className="font-medium">{t('side_panel.address')}:</span> {tent.address}
        </p>
      )}

      {(tent.website_url || tent.instagram_url || tent.facebook_url) && (
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          {tent.website_url && (
            <a
              className="rounded bg-white/10 px-3 py-1 hover:bg-white/20"
              href={tent.website_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              🌐 {t('side_panel.website')}
            </a>
          )}
          {tent.instagram_url && (
            <a
              className="rounded bg-white/10 px-3 py-1 hover:bg-white/20"
              href={tent.instagram_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              📷 {t('side_panel.instagram')}
            </a>
          )}
          {tent.facebook_url && (
            <a
              className="rounded bg-white/10 px-3 py-1 hover:bg-white/20"
              href={tent.facebook_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              👍 {t('side_panel.facebook')}
            </a>
          )}
        </div>
      )}

      <button
        onClick={onShare ?? (() => navigator.clipboard.writeText(window.location.href))}
        className="mt-auto rounded bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
      >
        🔗 {t('side_panel.share')}
      </button>
    </aside>
  );
}
