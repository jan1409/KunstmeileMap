# A3 Auth + Admin Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the first runnable slice of the Kunstmeile Admin CMS — an authenticated organizer can navigate to `/admin/login`, sign in with Supabase auth, get redirected into a protected admin shell, see their email, and sign out. This is A3-T01 + A3-T02 from the vault plan, bundled into one PR because they are mutually inert (provider with no consumer; routes with no provider).

**Architecture:**
- `AuthProvider` (React context) wraps the router and exposes `{ session, user, loading, signIn, signOut }` backed by `supabase.auth`. The Supabase client already has `persistSession: true` configured (`src/lib/supabase.ts`), so we just subscribe to `onAuthStateChange` and seed from `getSession()`.
- A `RequireAuth` guard component reads context and renders children when authenticated, redirects to `/admin/login` otherwise (preserving the intended destination via `location.state.from`).
- Admin pages live under `src/pages/admin/`. `AdminLayout` is a layout route with `<Outlet />`; child routes are nested under `/admin` with `RequireAuth` wrapping the layout.
- We follow the repo's hook convention by re-exporting `useAuth` from `src/hooks/useAuth.ts`. The implementation lives in `src/components/AuthProvider.tsx` (so consumers inside `components/` and `pages/` can import either path without a circular reference).

**Tech Stack:** React 19, TypeScript ~6, Vite 8, Vitest 4 (jsdom + globals + `tests/setup.ts`), `@testing-library/react` 16, `@supabase/supabase-js` 2.105, `react-router-dom` 7.

**Out of scope (later A3 tasks):** event/tent/category list pages, place-mode raycaster, tent edit form, photo upload, CSV import, event settings, `duplicate_event` RPC. None of those are needed to ship this slice.

**Existing context this plan assumes:**
- Phases A1 + A2 are complete on `main`. Working tree is clean. Last commit is `ce1d33e test(manual): visitor smoke checklist for pre-release validation`.
- Supabase migrations include `profiles` and `event_admins` tables with RLS policies. **This plan does NOT enforce admin-role gating** — anyone with a Supabase user can reach the dashboard. Admin-role enforcement belongs in a later A3 task (T08 in the vault plan, around the user-management page) and/or in row-level RLS on admin tables. We're shipping the auth wiring; the role check is the next layer.
- `src/lib/supabase.ts` already exports the typed client and row types.
- Test files live under `tests/unit/<area>/`. Component tests go in `tests/unit/components/`; admin page tests go in `tests/unit/pages/admin/`. Both directories are new.

---

## Task 1: Create feature branch

**Files:** none (git only).

- [ ] **Step 1: Verify clean working tree**

Run: `git status`
Expected:
```
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
```

If not clean, STOP and surface the unexpected state to the user.

- [ ] **Step 2: Create and switch to the feature branch**

Run: `git checkout -b feat/a3-auth-and-admin-shell`
Expected: `Switched to a new branch 'feat/a3-auth-and-admin-shell'`

- [ ] **Step 3: Create new test directories**

Run: `mkdir -p tests/unit/components tests/unit/pages/admin src/pages/admin`
Expected: no output, no error.

---

## Task 2: AuthProvider tests (red)

**Files:**
- Create: `tests/unit/components/AuthProvider.test.tsx`

This task writes the failing tests that pin down the AuthProvider contract. We mock `supabase.auth` completely so no network is hit and so we control session emission.

- [ ] **Step 1: Write the failing test file**

Create `tests/unit/components/AuthProvider.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';

// Hoisted mocks so we can manipulate session emission per test.
const mocks = vi.hoisted(() => {
  return {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    unsubscribe: vi.fn(),
  };
});

vi.mock('../../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
      signInWithPassword: mocks.signInWithPassword,
      signOut: mocks.signOut,
    },
  },
}));

import { AuthProvider, useAuth } from '../../../src/components/AuthProvider';

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

const fakeSession = {
  access_token: 'tok',
  refresh_token: 'r',
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: 'u1', email: 'admin@example.com' },
} as unknown;

describe('AuthProvider / useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mocks.unsubscribe } },
    });
    mocks.signInWithPassword.mockResolvedValue({ data: {}, error: null });
    mocks.signOut.mockResolvedValue({ error: null });
  });

  it('starts in loading state and resolves to no session', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();
  });

  it('exposes the user when getSession resolves with a session', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: fakeSession }, error: null });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).toBe(fakeSession);
    expect(result.current.user?.email).toBe('admin@example.com');
  });

  it('updates session when onAuthStateChange fires', async () => {
    let emit: (evt: string, s: unknown) => void = () => {};
    mocks.onAuthStateChange.mockImplementation((cb) => {
      emit = cb;
      return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).toBeNull();

    act(() => emit('SIGNED_IN', fakeSession));
    await waitFor(() => expect(result.current.session).toBe(fakeSession));
  });

  it('signIn calls supabase.auth.signInWithPassword and returns null error on success', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let returned: { error: Error | null } | undefined;
    await act(async () => {
      returned = await result.current.signIn('a@b.de', 'pw');
    });

    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.de', password: 'pw' });
    expect(returned!.error).toBeNull();
  });

  it('signIn wraps Supabase errors as Error', async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: {}, error: { message: 'Invalid login' } });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let returned: { error: Error | null } | undefined;
    await act(async () => {
      returned = await result.current.signIn('a@b.de', 'wrong');
    });

    expect(returned!.error).toBeInstanceOf(Error);
    expect(returned!.error!.message).toBe('Invalid login');
  });

  it('signOut calls supabase.auth.signOut', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signOut();
    });
    expect(mocks.signOut).toHaveBeenCalled();
  });

  it('useAuth throws when used outside AuthProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow(/AuthProvider/);
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npm run test:run -- tests/unit/components/AuthProvider.test.tsx`
Expected: FAIL — error contains `Failed to resolve import "../../../src/components/AuthProvider"` or similar (file does not exist yet).

---

## Task 3: AuthProvider + useAuth implementation (green) + App.tsx wiring + commit

**Files:**
- Create: `src/components/AuthProvider.tsx`
- Create: `src/hooks/useAuth.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create the provider**

Create `src/components/AuthProvider.tsx`:

```tsx
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthCtx {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthCtx>(() => ({
    session,
    user: session?.user ?? null,
    loading,
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error ? new Error(error.message) : null };
    },
    async signOut() {
      await supabase.auth.signOut();
    },
  }), [session, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
```

- [ ] **Step 2: Create the hook re-export**

Create `src/hooks/useAuth.ts`:

```ts
export { useAuth } from '../components/AuthProvider';
```

This keeps consumers free to import from `../hooks/useAuth` (matching `useEvent`, `useTents`, etc.) without the provider component depending on its own hook file.

- [ ] **Step 3: Wire AuthProvider into App.tsx**

Replace `src/App.tsx` contents:

```tsx
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './components/AuthProvider';
import { router } from './routes';

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
```

- [ ] **Step 4: Run AuthProvider tests, confirm green**

Run: `npm run test:run -- tests/unit/components/AuthProvider.test.tsx`
Expected: 7 passed.

- [ ] **Step 5: Run full unit suite to confirm no regression in A2 hooks**

Run: `npm run test:run`
Expected: all suites passing (existing `useEvent`, `useTents`, `useCategories`, `usePhotos` tests + 7 new tests).

- [ ] **Step 6: Type-check**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 7: Commit (matches A3-T01 commit boundary)**

Run:
```bash
git add src/components/AuthProvider.tsx src/hooks/useAuth.ts src/App.tsx tests/unit/components/AuthProvider.test.tsx
git commit -m "feat(auth): AuthProvider + useAuth hook with TDD coverage"
```

Expected: commit succeeds with the `Co-Authored-By` trailer if your commit hook adds it; otherwise plain.

---

## Task 4: RequireAuth (TDD)

**Files:**
- Create: `tests/unit/components/RequireAuth.test.tsx`
- Create: `src/components/RequireAuth.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/components/RequireAuth.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const useAuthMock = vi.fn();
vi.mock('../../../src/components/AuthProvider', () => ({
  useAuth: () => useAuthMock(),
}));

import { RequireAuth } from '../../../src/components/RequireAuth';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/login" element={<div>login-screen</div>} />
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <div>admin-content</div>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireAuth', () => {
  it('shows a loading placeholder while auth is loading', () => {
    useAuthMock.mockReturnValue({ session: null, loading: true });
    renderAt('/admin');
    expect(screen.queryByText('admin-content')).toBeNull();
    expect(screen.queryByText('login-screen')).toBeNull();
  });

  it('redirects to /admin/login when there is no session', () => {
    useAuthMock.mockReturnValue({ session: null, loading: false });
    renderAt('/admin');
    expect(screen.getByText('login-screen')).toBeInTheDocument();
  });

  it('renders children when session exists', () => {
    useAuthMock.mockReturnValue({ session: { user: { id: 'u1' } }, loading: false });
    renderAt('/admin');
    expect(screen.getByText('admin-content')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npm run test:run -- tests/unit/components/RequireAuth.test.tsx`
Expected: FAIL with import resolution error for `RequireAuth`.

- [ ] **Step 3: Implement the component**

Create `src/components/RequireAuth.tsx`:

```tsx
import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export function RequireAuth({ children }: { children: ReactElement }) {
  const { session, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="p-6 text-white/60">…</div>;
  if (!session) return <Navigate to="/admin/login" state={{ from: loc }} replace />;
  return children;
}
```

- [ ] **Step 4: Run test, confirm green**

Run: `npm run test:run -- tests/unit/components/RequireAuth.test.tsx`
Expected: 3 passed.

(No commit yet — bundling with LoginPage / AdminLayout / routes into the A3-T02 commit.)

---

## Task 5: LoginPage (TDD)

**Files:**
- Create: `tests/unit/pages/admin/LoginPage.test.tsx`
- Create: `src/pages/admin/LoginPage.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/pages/admin/LoginPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const signIn = vi.fn();
vi.mock('../../../../src/components/AuthProvider', () => ({
  useAuth: () => ({ signIn }),
}));

import LoginPage from '../../../../src/pages/admin/LoginPage';

function renderApp(initial = '/admin/login') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/admin" element={<div>admin-home</div>} />
        <Route path="/admin/events" element={<div>events-page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    signIn.mockReset();
  });

  it('renders email + password fields and a submit button', () => {
    renderApp();
    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('navigates to /admin on successful sign-in', async () => {
    signIn.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    renderApp();

    await user.type(screen.getByPlaceholderText(/email/i), 'a@b.de');
    await user.type(screen.getByPlaceholderText(/password/i), 'pw');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(signIn).toHaveBeenCalledWith('a@b.de', 'pw');
    expect(await screen.findByText('admin-home')).toBeInTheDocument();
  });

  it('shows the error message when sign-in fails', async () => {
    signIn.mockResolvedValue({ error: new Error('Invalid login') });
    const user = userEvent.setup();
    renderApp();

    await user.type(screen.getByPlaceholderText(/email/i), 'a@b.de');
    await user.type(screen.getByPlaceholderText(/password/i), 'bad');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Invalid login')).toBeInTheDocument();
  });
});
```

Note: `userEvent` lives in `@testing-library/user-event`, which is **not** currently in `devDependencies`. We need to add it before the test will run.

- [ ] **Step 2: Add `@testing-library/user-event` as a dev dependency**

Run: `npm install --save-dev @testing-library/user-event`
Expected: package added to `devDependencies` in `package.json`. Pin to whatever version npm resolves (currently `^14.x` is the v19-React-compatible line).

- [ ] **Step 3: Run the test, confirm it fails**

Run: `npm run test:run -- tests/unit/pages/admin/LoginPage.test.tsx`
Expected: FAIL with import resolution error for `LoginPage`.

- [ ] **Step 4: Implement the page**

Create `src/pages/admin/LoginPage.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation, type Location } from 'react-router-dom';
import { useAuth } from '../../components/AuthProvider';

interface LocationState {
  from?: Location;
}

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await signIn(email, password);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    const state = loc.state as LocationState | null;
    navigate(state?.from?.pathname ?? '/admin', { replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Admin Login</h1>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full rounded bg-white/10 p-2 text-white"
        />
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded bg-white/10 p-2 text-white"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          disabled={busy}
          className="w-full rounded bg-white/20 p-2 hover:bg-white/30 disabled:opacity-50"
        >
          {busy ? '…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 5: Run test, confirm green**

Run: `npm run test:run -- tests/unit/pages/admin/LoginPage.test.tsx`
Expected: 3 passed.

---

## Task 6: AdminLayout + DashboardPage (TDD light)

**Files:**
- Create: `tests/unit/pages/admin/AdminLayout.test.tsx`
- Create: `src/pages/admin/AdminLayout.tsx`
- Create: `src/pages/admin/DashboardPage.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/pages/admin/AdminLayout.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const signOut = vi.fn();
const useAuthValue = { user: { email: 'admin@example.com' }, signOut };
vi.mock('../../../../src/components/AuthProvider', () => ({
  useAuth: () => useAuthValue,
}));

import AdminLayout from '../../../../src/pages/admin/AdminLayout';

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<div>dashboard-content</div>} />
        </Route>
        <Route path="/admin/login" element={<div>login-screen</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminLayout', () => {
  beforeEach(() => signOut.mockReset());

  it('renders the user email and the dashboard outlet', () => {
    renderApp();
    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
    expect(screen.getByText('dashboard-content')).toBeInTheDocument();
  });

  it('signs out and redirects to /admin/login when Sign out is clicked', async () => {
    signOut.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: /sign out/i }));

    expect(signOut).toHaveBeenCalled();
    expect(await screen.findByText('login-screen')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npm run test:run -- tests/unit/pages/admin/AdminLayout.test.tsx`
Expected: FAIL with import resolution error for `AdminLayout`.

- [ ] **Step 3: Implement the layout**

Create `src/pages/admin/AdminLayout.tsx`:

```tsx
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../components/AuthProvider';

export default function AdminLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  async function onSignOut() {
    await signOut();
    navigate('/admin/login', { replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-white/10 p-4">
        <nav className="flex gap-4 text-sm">
          <Link to="/admin">Dashboard</Link>
          <Link to="/admin/events">Events</Link>
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-white/60">{user?.email}</span>
          <button
            onClick={onSignOut}
            className="rounded bg-white/10 px-2 py-1"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="flex-1 p-6"><Outlet /></main>
    </div>
  );
}
```

Note: I dropped the `/admin/users` link from the vault snippet — that page does not exist yet (it's A3-T08). We'll re-add it in that task. Showing nav links to non-existent routes makes the smoke test confusing.

- [ ] **Step 4: Implement the dashboard page (no separate test — pure presentational)**

Create `src/pages/admin/DashboardPage.tsx`:

```tsx
import { Link } from 'react-router-dom';

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Welcome</h1>
      <p className="mt-2 text-white/60">Quick actions:</p>
      <ul className="mt-2 list-disc pl-6 text-sm">
        <li><Link to="/admin/events" className="underline">Manage events</Link></li>
      </ul>
    </div>
  );
}
```

- [ ] **Step 5: Run test, confirm green**

Run: `npm run test:run -- tests/unit/pages/admin/AdminLayout.test.tsx`
Expected: 2 passed.

---

## Task 7: Wire admin routes + final verification + commit

**Files:**
- Modify: `src/routes.tsx`

- [ ] **Step 1: Update the router**

Replace `src/routes.tsx` contents:

```tsx
import { createBrowserRouter } from 'react-router-dom';
import EventViewPage from './pages/public/EventViewPage';
import ImpressumPage from './pages/public/ImpressumPage';
import DatenschutzPage from './pages/public/DatenschutzPage';
import NotFoundPage from './pages/public/NotFoundPage';
import LoginPage from './pages/admin/LoginPage';
import DashboardPage from './pages/admin/DashboardPage';
import AdminLayout from './pages/admin/AdminLayout';
import { RequireAuth } from './components/RequireAuth';

export const router = createBrowserRouter([
  { path: '/', element: <EventViewPage /> },
  { path: '/:eventSlug', element: <EventViewPage /> },
  { path: '/:eventSlug/tent/:tentSlug', element: <EventViewPage /> },
  { path: '/impressum', element: <ImpressumPage /> },
  { path: '/datenschutz', element: <DatenschutzPage /> },
  { path: '/admin/login', element: <LoginPage /> },
  {
    path: '/admin',
    element: (
      <RequireAuth>
        <AdminLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      // event/tent/category routes added in later A3 tasks
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
```

- [ ] **Step 2: Type-check the whole app**

Run: `npm run type-check`
Expected: no errors. If TypeScript complains about `JSX.Element` vs `ReactElement` for `RequireAuth`'s `children` prop, the implementation in Task 4 already uses `ReactElement` from `react`, which is the correct React-19-friendly type.

- [ ] **Step 3: Run the full test suite**

Run: `npm run test:run`
Expected: all suites pass, including the 7 + 3 + 3 + 2 = 15 new admin/auth tests plus the existing A2 hook tests.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors. (Warnings on existing files are out of scope; fix only new ones.)

- [ ] **Step 5: Manual smoke test in the browser**

Run: `npm run dev`

Verify in a browser at the printed URL (usually `http://localhost:5173`):

- a. Visit `/admin` while signed out → redirects to `/admin/login` and shows the login form.
- b. Submit the form with bogus credentials → red error message appears below the form, no navigation.
- c. Submit valid credentials (a Supabase user that exists in the project — create one in the Supabase dashboard if needed) → lands on `/admin` with the dashboard, shows your email in the header, "Manage events" link visible.
- d. Click "Sign out" → returns to `/admin/login`, header email gone.
- e. Reload the page while signed in → still authenticated (Supabase persists session in localStorage).
- f. Public routes still work: `/` shows the default event, `/impressum` and `/datenschutz` render.

If any of (a)–(f) fails, STOP and surface the failure. Do not commit a broken admin shell.

Stop the dev server (Ctrl+C in the terminal running `npm run dev`).

- [ ] **Step 6: Commit (matches A3-T02 commit boundary)**

Run:
```bash
git add src/components/RequireAuth.tsx src/pages/admin src/routes.tsx package.json package-lock.json tests/unit/components/RequireAuth.test.tsx tests/unit/pages
git commit -m "feat(admin): protected admin shell — login, dashboard, layout, route guard"
```

Expected: commit succeeds.

- [ ] **Step 7: Verify branch state**

Run: `git log --oneline main..HEAD`
Expected: exactly two commits — `feat(auth): AuthProvider + useAuth hook with TDD coverage` and `feat(admin): protected admin shell — login, dashboard, layout, route guard`.

---

## Self-review checklist (run before declaring done)

- [ ] All A3-T01 vault requirements satisfied: `AuthProvider` exists, exposes `{ session, user, loading, signIn, signOut }`; `useAuth` accessible from `src/hooks/useAuth.ts`; App wraps router in provider.
- [ ] All A3-T02 vault requirements satisfied: `/admin/login` renders form; `/admin` is guarded; `AdminLayout` shows email + sign-out; `DashboardPage` is the index route.
- [ ] No remaining placeholders, TODOs, or `any` (other than the small `LocationState` cast which is properly typed).
- [ ] Existing A2 tests still pass.
- [ ] No nav link to a not-yet-implemented route (the `/admin/users` link was deliberately deferred).

## What this plan deliberately does NOT do

- Admin **role** check. Any Supabase-authenticated user can reach the dashboard. Wiring `event_admins` / `profiles.is_admin` checks belongs in A3-T08 (user management) or as a `RequireAdmin` enhancement once that page exists. The DB RLS policies already prevent non-admins from mutating data, so this is a UX-tightening, not a security-tightening, gap.
- i18n on the login page. The vault plan doesn't translate admin UI in A3, and A4 is the polish phase.
- Password reset / sign-up flows. Out of scope; admin users are provisioned in the Supabase dashboard.
- Session timeout warnings, MFA, social login. Phase 2.
