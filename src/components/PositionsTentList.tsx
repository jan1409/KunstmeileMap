import { useTranslation } from 'react-i18next';

export interface PositionsTentListItem {
  id: string;
  name: string;
  display_number: number | null;
}

interface Props {
  placed: PositionsTentListItem[];
  unplaced: PositionsTentListItem[];
  dirtyIds: Set<string>;
  selectedId: string | null;
  canEdit: boolean;
  onSelect: (id: string) => void;
  onRevert: (id: string) => void;
}

export function PositionsTentList({
  placed,
  unplaced,
  dirtyIds,
  selectedId,
  canEdit,
  onSelect,
  onRevert,
}: Props) {
  const { t } = useTranslation();

  return (
    <aside
      aria-label={t('admin.positions.placed_heading', { count: placed.length })}
      className="flex h-full w-56 shrink-0 flex-col overflow-y-auto border-r border-white/10 bg-neutral-900/40 text-sm"
    >
      <section className="p-3">
        <h2 className="mb-2 text-xs uppercase tracking-wide text-white/60">
          {t('admin.positions.placed_heading', { count: placed.length })}
        </h2>
        {placed.length === 0 ? (
          <p className="text-xs text-white/50">
            {t('admin.positions.placed_empty')}
          </p>
        ) : (
          <ul className="space-y-1">
            {placed.map((tent) => {
              const isDirty = dirtyIds.has(tent.id);
              const isSelected = selectedId === tent.id;
              return (
                <li key={tent.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onSelect(tent.id)}
                    aria-current={isSelected ? 'true' : undefined}
                    className={`flex flex-1 items-center gap-2 rounded px-2 py-1 text-left hover:bg-white/10 ${
                      isSelected ? 'bg-white/15 ring-1 ring-white/30' : ''
                    } ${isDirty ? 'text-yellow-300' : ''}`}
                  >
                    {tent.display_number != null && (
                      <span className="font-mono text-xs text-white/60">
                        #{tent.display_number}
                      </span>
                    )}
                    <span className="flex-1 truncate">{tent.name}</span>
                  </button>
                  {canEdit && isDirty && (
                    <button
                      type="button"
                      onClick={() => onRevert(tent.id)}
                      aria-label={t('admin.positions.revert_aria', { name: tent.name })}
                      className="rounded px-2 py-1 text-xs text-white/60 hover:bg-white/10 hover:text-white"
                    >
                      ↺
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {unplaced.length > 0 && (
        <section className="border-t border-white/10 p-3">
          <h2 className="mb-2 text-xs uppercase tracking-wide text-white/60">
            {t('admin.positions.unplaced_heading', { count: unplaced.length })}
          </h2>
          <ul className="space-y-1">
            {unplaced.map((tent) => (
              <li key={tent.id} className="px-2 py-1 text-white/50">
                {tent.name}
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
