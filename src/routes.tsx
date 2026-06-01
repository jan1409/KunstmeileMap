import { lazy, Suspense, type ReactElement } from 'react';
import { createBrowserRouter, Outlet } from 'react-router-dom';
import EventViewPage from './pages/public/EventViewPage';
import ImpressumPage from './pages/public/ImpressumPage';
import DatenschutzPage from './pages/public/DatenschutzPage';
import NotFoundPage from './pages/public/NotFoundPage';
import { RequireAuth } from './components/RequireAuth';
import { RequireEventRole } from './components/RequireEventRole';
import { CookieBanner } from './components/CookieBanner';
import { ToastProvider } from './components/ToastProvider';

// Admin pages are gated behind /admin and not part of the public visitor flow,
// so they live in their own chunks. RequireAuth short-circuits non-admins with
// a Navigate before the AdminLayout chunk request is even fired.
const LoginPage = lazy(() => import('./pages/admin/LoginPage'));
const WelcomePage = lazy(() => import('./pages/admin/WelcomePage'));
const NoAccessPage = lazy(() => import('./pages/admin/NoAccessPage'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage'));
const EventListPage = lazy(() => import('./pages/admin/EventListPage'));
const TentListPage = lazy(() => import('./pages/admin/TentListPage'));
const TentEditPage = lazy(() => import('./pages/admin/TentEditPage'));
const TentImportPage = lazy(() => import('./pages/admin/TentImportPage'));
const CategoryListPage = lazy(() => import('./pages/admin/CategoryListPage'));
const EventSettingsPage = lazy(() => import('./pages/admin/EventSettingsPage'));
const UsersPage = lazy(() => import('./pages/admin/UsersPage'));
const PositionsPage = lazy(() => import('./pages/admin/PositionsPage'));

const adminFallback = (
  <div
    role="status"
    aria-live="polite"
    className="flex min-h-screen items-center justify-center bg-neutral-900 p-6 text-white/80"
  >
    …
  </div>
);

function suspended(node: ReactElement): ReactElement {
  return <Suspense fallback={adminFallback}>{node}</Suspense>;
}

// Layout route that wraps every page so the CookieBanner is always mounted
// and has access to the Router context (Link).
function RootLayout() {
  return (
    <ToastProvider>
      <Outlet />
      <CookieBanner />
    </ToastProvider>
  );
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <EventViewPage /> },
      { path: '/:eventSlug', element: <EventViewPage /> },
      { path: '/:eventSlug/tent/:tentSlug', element: <EventViewPage /> },
      { path: '/impressum', element: <ImpressumPage /> },
      { path: '/datenschutz', element: <DatenschutzPage /> },
      { path: '/admin/login', element: suspended(<LoginPage />) },
      { path: '/admin/welcome', element: suspended(<WelcomePage />) },
      { path: '/admin/no-access', element: suspended(<NoAccessPage />) },
      {
        path: '/admin',
        element: <RequireAuth>{suspended(<AdminLayout />)}</RequireAuth>,
        children: [
          { index: true, element: suspended(<DashboardPage />) },
          { path: 'events', element: suspended(<EventListPage />) },
          {
            path: 'events/:eventSlug/tents',
            element: (
              <RequireEventRole minRole="contributor">
                {suspended(<TentListPage />)}
              </RequireEventRole>
            ),
          },
          {
            path: 'events/:eventSlug/tents/new',
            element: (
              <RequireEventRole minRole="editor">
                {suspended(<TentEditPage />)}
              </RequireEventRole>
            ),
          },
          {
            path: 'events/:eventSlug/tents/import',
            element: (
              <RequireEventRole minRole="editor">
                {suspended(<TentImportPage />)}
              </RequireEventRole>
            ),
          },
          {
            path: 'events/:eventSlug/tents/:tentId',
            element: (
              <RequireEventRole minRole="contributor">
                {suspended(<TentEditPage />)}
              </RequireEventRole>
            ),
          },
          {
            path: 'events/:eventSlug/positions',
            element: (
              <RequireEventRole minRole="contributor">
                {suspended(<PositionsPage />)}
              </RequireEventRole>
            ),
          },
          {
            path: 'events/:eventSlug/categories',
            element: (
              <RequireEventRole minRole="editor">
                {suspended(<CategoryListPage />)}
              </RequireEventRole>
            ),
          },
          {
            path: 'events/:eventSlug/settings',
            element: (
              <RequireEventRole minRole="owner">
                {suspended(<EventSettingsPage />)}
              </RequireEventRole>
            ),
          },
          {
            path: 'events/:eventSlug/users',
            element: (
              <RequireEventRole minRole="owner">
                {suspended(<UsersPage />)}
              </RequireEventRole>
            ),
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
