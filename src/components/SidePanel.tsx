import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { Category, TentWithCategories } from '../lib/supabase';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { AddPhotosControl } from './AddPhotosControl';

interface Props {
  tent: TentWithCategories | null;
  categories: Category[];
  photoUrls: string[];
  onClose: () => void;
  onShare?: () => void;
  /** Required when canEdit is true. */
  eventId?: string;
  canEdit?: boolean;
  onPhotosChanged?: () => void;
}

export function SidePanel({
  tent,
  categories,
  photoUrls,
  onClose,
  onShare,
  eventId,
  canEdit = false,
  onPhotosChanged,
}: Props) {
  const { t, i18n } = useTranslation();
  const trapRef = useFocusTrap<HTMLElement>(tent !== null);
  if (!tent) return null;

  const lang = i18n.language as 'de' | 'en';
  const description =
    (lang === 'de' ? tent.description_de : tent.description_en) || tent.description_de;
  const categoryLabel = (c: Category) =>
    (lang === 'en' ? c.name_en : c.name_de) ?? c.name_de;

  return (
    <aside
      ref={trapRef}
      role="dialog"
      aria-label={tent.name}
      className="fixed bottom-0 right-0 z-30 flex h-[33vh] w-full flex-col overflow-y-auto bg-neutral-900/95 p-6 text-white shadow-2xl backdrop-blur-md md:top-0 md:h-full md:w-[400px] md:rounded-l-lg"
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

      <h2 className="pr-8 text-2xl font-semibold">
        {tent.display_number != null && (
          <span className="mr-2 text-white/50">#{tent.display_number}</span>
        )}
        {tent.name}
      </h2>

      {categories.length > 0 && (
        <ul className="mt-1 flex flex-wrap gap-1">
          {categories.map((c) => (
            <li
              key={c.id}
              className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/80"
            >
              {c.icon} {categoryLabel(c)}
            </li>
          ))}
        </ul>
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

      {canEdit && eventId && tent && onPhotosChanged && (
        <div className="mt-2 flex flex-col gap-2 border-t border-white/10 pt-2">
          <AddPhotosControl
            eventId={eventId}
            tentId={tent.id}
            onUploaded={onPhotosChanged}
          />
          <Link
            to={`/admin/tents/${tent.id}/edit`}
            className="text-xs text-white/60 hover:text-white"
          >
            ✎ {t('side_panel.manage_photos')}
          </Link>
        </div>
      )}

      {photoUrls.length > 0 && (
        <div className="mt-4 -mx-1 flex shrink-0 snap-x snap-mandatory gap-2 overflow-x-auto pb-2">
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

      <button
        onClick={onShare ?? (() => navigator.clipboard.writeText(window.location.href))}
        className="rounded bg-white/10 px-3 py-2 text-sm hover:bg-white/20 md:mt-auto"
      >
        🔗 {t('side_panel.share')}
      </button>
    </aside>
  );
}
