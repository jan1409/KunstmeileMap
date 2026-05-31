import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEvent } from '../../hooks/useEvent';
import { useTents } from '../../hooks/useTents';
import { useCategories } from '../../hooks/useCategories';
import { usePhotos } from '../../hooks/usePhotos';
import { useEventPermissions } from '../../hooks/useEventPermissions';
import { MapView } from '../../components/MapView';
import { SidePanel } from '../../components/SidePanel';
import { TopBar } from '../../components/TopBar';
import { BackToOverviewButton } from '../../components/BackToOverviewButton';
import type { Tent, TentWithCategories } from '../../lib/supabase';

export default function EventViewPage() {
  const { t } = useTranslation();
  const { eventSlug, tentSlug } = useParams();
  const navigate = useNavigate();

  const { event, loading, error } = useEvent(eventSlug);
  const { tents } = useTents(event?.id);
  const { categories } = useCategories(event?.id);
  const perms = useEventPermissions(event?.id);

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(
    new Set(),
  );

  const selectedTent = useMemo(
    () => tents.find((tnt) => tnt.slug === tentSlug) ?? null,
    [tents, tentSlug],
  );

  const [photosReloadKey, setPhotosReloadKey] = useState(0);
  const photoUrls = usePhotos(selectedTent?.id, photosReloadKey);

  const visibleTents = useMemo(() => {
    if (selectedCategoryIds.size === 0) return tents;
    return tents.filter((tnt) =>
      (tnt.categories ?? []).some((c) => selectedCategoryIds.has(c.id)),
    );
  }, [tents, selectedCategoryIds]);

  const tentsWithoutCoords = tents.filter(
    (tnt) => tnt.lat == null || tnt.lng == null,
  ).length;

  function selectTentBySlug(slug: string | null) {
    if (!event) return;
    if (slug) navigate(`/${event.slug}/tent/${slug}`);
    else navigate(`/${event.slug}`);
  }

  function toggleCategory(id: string) {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearCategories() {
    setSelectedCategoryIds(new Set());
  }

  if (loading) return <p className="p-6">{t('app.loading')}</p>;
  if (error || !event) return <p className="p-6">{t('event.not_found')}</p>;

  return (
    <div className="relative flex h-screen w-screen flex-col">
      <TopBar
        tents={tents}
        categories={categories}
        selectedCategoryIds={selectedCategoryIds}
        onSelectTent={(tnt: Tent) => selectTentBySlug(tnt.slug)}
        onToggleCategory={toggleCategory}
        onClearCategories={clearCategories}
      />

      <main className="relative flex-1">
        <MapView
          tents={visibleTents}
          center={[event.default_lat, event.default_lng]}
          zoom={event.default_zoom}
          focusTent={selectedTent}
          onMarkerClick={(tnt: TentWithCategories) =>
            selectTentBySlug(tnt.slug)
          }
        />

        {tentsWithoutCoords > 0 && (
          <div
            role="status"
            className="pointer-events-auto absolute bottom-3 left-1/2 z-[1000] -translate-x-1/2 rounded bg-black/70 px-3 py-1 text-xs text-white shadow"
          >
            {t('map.no_coords_banner', { count: tentsWithoutCoords })}
          </div>
        )}

        <BackToOverviewButton
          visible={selectedTent != null}
          panelOpen={selectedTent != null}
          onClick={() => selectTentBySlug(null)}
        />
      </main>

      {selectedTent && (
        <SidePanel
          tent={selectedTent}
          categories={selectedTent.categories ?? []}
          photoUrls={photoUrls}
          onClose={() => selectTentBySlug(null)}
          eventId={event.id}
          canEdit={perms.canContribute}
          onPhotosChanged={() => setPhotosReloadKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
