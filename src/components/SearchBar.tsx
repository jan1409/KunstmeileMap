import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Tent } from '../lib/supabase';

interface Props {
  tents: Tent[];
  onSelect: (tent: Tent) => void;
}

export function SearchBar({ tents, onSelect }: Props) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setDebounced(q), 200);
    return () => clearTimeout(id);
  }, [q]);

  const matches =
    debounced.length === 0
      ? []
      : tents
          .filter((tnt) => tnt.name.toLowerCase().includes(debounced.toLowerCase()))
          .slice(0, 8);

  return (
    <div className="relative">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('search.placeholder')}
        className="w-64 rounded bg-white/10 px-3 py-1.5 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
      />
      {matches.length > 0 && (
        <ul className="absolute mt-1 w-64 overflow-hidden rounded bg-neutral-900/95 shadow-xl backdrop-blur">
          {matches.map((m) => (
            <li key={m.id}>
              <button
                onClick={() => {
                  onSelect(m);
                  setQ('');
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-white/10"
              >
                {m.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {debounced.length > 0 && matches.length === 0 && (
        <p className="absolute mt-1 w-64 rounded bg-neutral-900/95 px-3 py-2 text-sm text-white/60 backdrop-blur">
          {t('search.no_results')}
        </p>
      )}
    </div>
  );
}
