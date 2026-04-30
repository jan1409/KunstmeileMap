import type { Tent, Category } from '../lib/supabase';
import { SearchBar } from './SearchBar';
import { CategoryFilter } from './CategoryFilter';
import { LanguageToggle } from './LanguageToggle';

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
  return (
    <header className="absolute left-0 right-0 top-0 z-20 flex flex-wrap items-center gap-3 bg-gradient-to-b from-black/70 to-transparent p-3 text-white md:gap-4 md:p-4">
      <h1 className="text-base font-semibold md:text-lg">Kunstmeile</h1>
      <SearchBar tents={tents} onSelect={onSelectTent} />
      <div className="order-3 flex-1 overflow-x-auto md:order-2">
        <CategoryFilter
          categories={categories}
          selected={selectedCategoryIds}
          onToggle={onToggleCategory}
          onClear={onClearCategories}
        />
      </div>
      <div className="md:order-3">
        <LanguageToggle />
      </div>
    </header>
  );
}
