import { useTranslation } from 'react-i18next';
import type { Category } from '../lib/supabase';

interface Props {
  categories: Category[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onClear: () => void;
}

export function CategoryFilter({ categories, selected, onToggle, onClear }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith('en') ? 'en' : 'de';

  return (
    <div className="flex flex-wrap items-center gap-1">
      <button
        onClick={onClear}
        aria-label={t('category.all')}
        className={`rounded px-2 py-1 text-xs ${
          selected.size === 0 ? 'bg-white/20' : 'hover:bg-white/10'
        }`}
      >
        {t('category.all')}
      </button>
      {categories.map((c) => {
        const label = (lang === 'en' ? c.name_en : c.name_de) ?? c.name_de;
        return (
          <button
            key={c.id}
            onClick={() => onToggle(c.id)}
            className={`rounded px-2 py-1 text-xs ${
              selected.has(c.id) ? 'bg-white/20' : 'hover:bg-white/10'
            }`}
          >
            {c.icon ? `${c.icon} ${label}` : label}
          </button>
        );
      })}
    </div>
  );
}
