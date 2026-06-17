import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // Scope to the Vitest suite so the Deno-runtime Edge Function tests under
    // supabase/functions/ (run via `deno test`) are not picked up by Node.
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
  },
})
