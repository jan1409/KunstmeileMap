import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { Tent, Category } from '../lib/supabase';
import { SearchBar } from './SearchBar';
import { CategoryFilter } from './CategoryFilter';
import { LanguageToggle } from './LanguageToggle';
import { useIsMobile } from '../hooks/useIsMobile';
import { useAuth } from './AuthProvider';
import logoUrl from '../assets/Logo_Kunstmeile_plain.png';

interface Props {
  tents: Tent[];
  categories: Category[];
  selectedCategoryIds: Set<string>;
  onSelectTent: (tent: Tent) => void;
  onToggleCategory: (id: string) => void;
  onClearCategories: () => void;
}

export function TopBar({
  tents,
  categories,
  selectedCategoryIds,
  onSelectTent,
  onToggleCategory,
  onClearCategories,
}: Props) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const showControls = !isMobile || open;

  return (
    <header className="absolute left-0 right-0 top-0 z-[1000] flex flex-col gap-2 bg-neutral-900/85 p-3 text-white shadow-lg backdrop-blur-sm md:flex-row md:flex-wrap md:items-center md:gap-4 md:p-4">
      <div className="flex items-center justify-between gap-3 md:contents">
        <img
          src={logoUrl}
          alt="Kunstmeile"
          className="h-8 w-auto md:h-10"
        />
        {isMobile && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={t(open ? 'app.menu_close' : 'app.menu_open')}
            aria-expanded={open}
            className="rounded bg-white/10 p-2 text-base leading-none hover:bg-white/20 md:hidden"
          >
            {open ? '✕' : '☰'}
          </button>
        )}
      </div>
      {showControls && (
        <>
          <SearchBar tents={tents} onSelect={onSelectTent} />
          <div className="flex-1 overflow-x-auto md:order-2">
            <CategoryFilter
              categories={categories}
              selected={selectedCategoryIds}
              onToggle={onToggleCategory}
              onClear={onClearCategories}
            />
          </div>
          <div className="flex items-center gap-2 md:order-3">
            <LanguageToggle />
            <Link
              to="/admin"
              className="rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
            >
              {session ? t('app.admin_link') : t('app.login_link')}
            </Link>
          </div>
        </>
      )}
    </header>
  );
}
