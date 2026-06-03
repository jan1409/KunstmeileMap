import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Stub Vite env vars so that modules importing supabase at top level
// don't blow up when developer/CI runs tests without a real .env.local
vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
vi.stubEnv('VITE_DEFAULT_EVENT_SLUG', 'kunstmeile-2026');

// jsdom has no window.matchMedia. Provide a desktop-default stub (matches:false)
// so components using useIsMobile render in tests. Individual tests that care
// about the mobile branch override this via vi.stubGlobal('matchMedia', ...).
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}
