import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEvent } from '../../hooks/useEvent';
import { TopBar } from '../../components/TopBar';

export default function EventViewPage() {
  const { t } = useTranslation();
  const { eventSlug } = useParams();
  const { event, loading, error } = useEvent(eventSlug);

  if (loading) return <p className="p-6">…</p>;
  if (error || !event) return <p className="p-6">{t('event.not_found')}</p>;

  return (
    <div className="flex h-screen w-screen flex-col">
      <TopBar
        tents={[]}
        categories={[]}
        selectedCategoryIds={new Set<string>()}
        onSelectTent={() => {}}
        onToggleCategory={() => {}}
        onClearCategories={() => {}}
      />
      <main className="flex flex-1 items-center justify-center text-white/60">
        Map view — coming in T3
      </main>
    </div>
  );
}
