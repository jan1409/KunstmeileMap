import React from 'react';
import ReactDOM from 'react-dom/client';
import SnapshotApp from './SnapshotApp';
import '../styles/globals.css';
import '../lib/i18n';
import type { SnapshotData } from '../lib/snapshot';

/**
 * Entry point for the offline "viewer" build (VITE_SNAPSHOT=1). Reads the event
 * data the export step injected into the `#km-snapshot-data` script tag and
 * hands it to the rest of the app via `window.__KM_SNAPSHOT__` (where
 * `getSnapshot()` looks for it), then mounts the public-only app.
 */
function readSnapshot(): SnapshotData | undefined {
  const el = document.getElementById('km-snapshot-data');
  const raw = el?.textContent?.trim();
  if (!raw || raw === '__KM_SNAPSHOT_DATA__') return undefined;
  try {
    return JSON.parse(raw) as SnapshotData;
  } catch {
    return undefined;
  }
}

window.__KM_SNAPSHOT__ = readSnapshot();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SnapshotApp />
  </React.StrictMode>,
);
