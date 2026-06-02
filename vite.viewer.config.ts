import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Build config for the offline "viewer" bundle (the web-optimized snapshot
 * export). Produces a single self-contained `dist/viewer.html` — all JS/CSS
 * inlined — that the admin export step fetches, fills with event data, and zips.
 *
 * - `VITE_SNAPSHOT=1` flips the data hooks to read embedded data (no Supabase).
 * - `base: './'` keeps any asset refs relative so the bundle runs from `file://`
 *   or any static-host subpath.
 * - `emptyOutDir: false` so it can be emitted next to the main app build.
 */
export default defineConfig({
  base: './',
  define: {
    'import.meta.env.VITE_SNAPSHOT': JSON.stringify('1'),
  },
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: 'viewer.html',
    },
  },
});
