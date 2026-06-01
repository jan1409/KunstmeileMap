import { useEffect, useMemo, useState } from 'react';
import { Link, useBlocker, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useEvent } from '../../hooks/useEvent';
import { useTents } from '../../hooks/useTents';
import { useEventPermissions } from '../../hooks/useEventPermissions';
import { useTileStyle } from '../../hooks/useTileStyle';
import { useDirtyPositions, type Coords } from '../../hooks/useDirtyPositions';
import { useToast } from '../../components/ToastProvider';
import { PositionsMap, type PositionsMapTent } from '../../components/PositionsMap';
import {
  PositionsTentList,
  type PositionsTentListItem,
} from '../../components/PositionsTentList';

const MOBILE_QUERY = '(max-width: 767.98px)';

export default function PositionsPage() {
  const { t } = useTranslation();
  const { eventSlug } = useParams();
  const { event } = useEvent(eventSlug);
  const { tents } = useTents(event?.id);
  const { canEdit } = useEventPermissions(event?.id);
  const [tileStyle, setTileStyle] = useTileStyle();
  const { showSuccess, showError } = useToast();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Track viewport — mobile gate hides the editor below md.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(MOBILE_QUERY);
    setIsMobile(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const placedTents: PositionsMapTent[] = useMemo(
    () =>
      tents
        .filter(
          (tent): tent is typeof tent & { lat: number; lng: number } =>
            tent.lat != null && tent.lng != null,
        )
        .map((tent) => ({
          id: tent.id,
          name: tent.name,
          display_number: tent.display_number,
          lat: tent.lat,
          lng: tent.lng,
        })),
    [tents],
  );

  const unplacedListItems: PositionsTentListItem[] = useMemo(
    () =>
      tents
        .filter((tent) => tent.lat == null || tent.lng == null)
        .map((tent) => ({
          id: tent.id,
          name: tent.name,
          display_number: tent.display_number,
        })),
    [tents],
  );

  const placedListItems: PositionsTentListItem[] = useMemo(
    () =>
      placedTents.map((tent) => ({
        id: tent.id,
        name: tent.name,
        display_number: tent.display_number,
      })),
    [placedTents],
  );

  const originals: Record<string, Coords> = useMemo(() => {
    const out: Record<string, Coords> = {};
    for (const tent of placedTents) {
      out[tent.id] = { lat: tent.lat, lng: tent.lng };
    }
    return out;
  }, [placedTents]);

  // Local overrides that survive after a successful save until useTents refetches.
  const [committedOverrides, setCommittedOverrides] = useState<
    Record<string, Coords>
  >({});

  // Drop an override id only when the original has caught up (matches within
  // epsilon). Until then, the override holds so the marker doesn't jump back.
  useEffect(() => {
    setCommittedOverrides((prev) => {
      const next: Record<string, Coords> = {};
      for (const [id, coords] of Object.entries(prev)) {
        const orig = originals[id];
        if (
          orig &&
          Math.abs(orig.lat - coords.lat) < 1e-9 &&
          Math.abs(orig.lng - coords.lng) < 1e-9
        ) {
          continue; // drop — refetch matched
        }
        next[id] = coords;
      }
      return next;
    });
  }, [originals]);

  const effectiveOriginals = useMemo(
    () => ({ ...originals, ...committedOverrides }),
    [originals, committedOverrides],
  );

  const dirty = useDirtyPositions(effectiveOriginals);

  // Apply staged edits (and any post-save overrides) over the original positions.
  const renderedTents: PositionsMapTent[] = useMemo(
    () =>
      placedTents.map((tent) => {
        const coords =
          dirty.getCoords(tent.id) ?? effectiveOriginals[tent.id] ?? tent;
        return { ...tent, lat: coords.lat, lng: coords.lng };
      }),
    [placedTents, dirty, effectiveOriginals],
  );

  // Browser-level "you have unsaved changes" guard.
  useEffect(() => {
    if (dirty.dirtyCount === 0) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty.dirtyCount]);

  // In-app navigation guard — intercept route changes when there are unsaved edits.
  useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty.dirtyCount > 0 &&
      currentLocation.pathname !== nextLocation.pathname &&
      !window.confirm(t('admin.positions.nav_guard_message')),
  );

  if (!event) return null;

  if (isMobile) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <h1 className="mb-2 text-xl font-semibold">
          {t('admin.positions.mobile_gate_title')}
        </h1>
        <p className="mb-4 text-sm text-white/70">
          {t('admin.positions.mobile_gate_body')}
        </p>
        <Link
          to={`/admin/events/${event.slug}/tents`}
          className="rounded bg-white/20 px-3 py-1 text-sm"
        >
          {t('admin.positions.mobile_gate_link')}
        </Link>
      </div>
    );
  }

  async function onSave() {
    const ids = [...dirty.dirtyIds];
    if (ids.length === 0) return;
    setSaving(true);
    try {
      const results = await Promise.allSettled(
        ids.map((id) => {
          const coords = dirty.getCoords(id);
          if (!coords) return Promise.resolve();
          return supabase
            .from('tents')
            .update({ lat: coords.lat, lng: coords.lng })
            .eq('id', id)
            .then((r: { error: { message: string } | null }) => {
              if (r.error) throw new Error(r.error.message);
            });
        }),
      );
      const okIds: string[] = [];
      const failures: string[] = [];
      results.forEach((r, idx) => {
        const id = ids[idx]!;
        if (r.status === 'fulfilled') okIds.push(id);
        else failures.push((r.reason as Error).message ?? 'error');
      });
      // Capture committed coords so the marker doesn't jump back after commit
      // (useTents hasn't refetched yet — the override holds until it does).
      if (okIds.length > 0) {
        const overrides: Record<string, Coords> = {};
        for (const id of okIds) {
          const c = dirty.getCoords(id);
          if (c) overrides[id] = c;
        }
        setCommittedOverrides((prev) => ({ ...prev, ...overrides }));
      }
      dirty.commit(okIds);
      if (failures.length === 0) {
        showSuccess(t('admin.positions.save_success', { count: okIds.length }));
      } else {
        showError(
          t('admin.positions.save_partial_error', {
            ok: okIds.length,
            total: ids.length,
            failed: failures.length,
            message: failures[0] ?? '',
          }),
        );
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    // Subtract ~7rem to account for AdminLayout's header (~53px) + main's
    // p-6 padding (48px). With only 4rem we overflowed by ~37px, which
    // clipped the Save footer below the viewport.
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      <h1 className="mb-2 text-xl font-semibold">
        {t('admin.positions.heading', { title: event.title_de })}
      </h1>
      <div className="flex flex-1 overflow-hidden rounded border border-white/10">
        <PositionsTentList
          placed={placedListItems}
          unplaced={unplacedListItems}
          dirtyIds={dirty.dirtyIds}
          selectedId={selectedId}
          canEdit={canEdit}
          onSelect={setSelectedId}
          onRevert={dirty.revert}
        />
        <div className="flex-1">
          <PositionsMap
            tents={renderedTents}
            dirtyIds={dirty.dirtyIds}
            focusTentId={selectedId}
            canEdit={canEdit}
            tileStyle={tileStyle}
            onTileStyleChange={setTileStyle}
            onPositionChange={(id, lat, lng) => dirty.set(id, { lat, lng })}
            defaultCenter={[event.default_lat, event.default_lng]}
            defaultZoom={event.default_zoom}
          />
        </div>
      </div>
      {canEdit && (
        <div className="mt-3 flex shrink-0 items-center gap-3 rounded border border-white/10 bg-neutral-900/60 p-3">
          <button
            type="button"
            onClick={onSave}
            disabled={dirty.dirtyCount === 0 || saving}
            className="rounded bg-emerald-500/80 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-40"
          >
            {saving
              ? t('admin.positions.saving')
              : t('admin.positions.save_button', { count: dirty.dirtyCount })}
          </button>
          {dirty.dirtyCount > 0 && (
            <button
              type="button"
              onClick={() => setConfirmDiscard(true)}
              className="rounded bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
            >
              {t('admin.positions.discard_button')}
            </button>
          )}
        </div>
      )}

      {confirmDiscard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div
            role="dialog"
            aria-labelledby="discard-h"
            className="w-full max-w-sm rounded bg-neutral-900 p-4 text-white"
          >
            <h2 id="discard-h" className="mb-2 text-base font-semibold">
              {t('admin.positions.discard_confirm_heading', {
                count: dirty.dirtyCount,
              })}
            </h2>
            <p className="mb-4 text-sm text-white/70">
              {t('admin.positions.discard_confirm_body')}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDiscard(false)}
                className="rounded bg-white/10 px-3 py-1 text-sm"
              >
                {t('admin.positions.discard_confirm_cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  dirty.revertAll();
                  setConfirmDiscard(false);
                }}
                className="rounded bg-red-500/80 px-3 py-1 text-sm font-medium"
              >
                {t('admin.positions.discard_confirm_submit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
