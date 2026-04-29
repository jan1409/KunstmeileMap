import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Stub Vite env vars so that modules importing supabase at top level
// don't blow up when developer/CI runs tests without a real .env.local
vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
vi.stubEnv('VITE_DEFAULT_EVENT_SLUG', 'kunstmeile-2026');
