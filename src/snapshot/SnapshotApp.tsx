import { createHashRouter, Outlet, RouterProvider } from 'react-router-dom';
import EventViewPage from '../pages/public/EventViewPage';
import ImpressumPage from '../pages/public/ImpressumPage';
import DatenschutzPage from '../pages/public/DatenschutzPage';
import NotFoundPage from '../pages/public/NotFoundPage';
import { AuthProvider } from '../components/AuthProvider';
import { CookieBanner } from '../components/CookieBanner';
import { ToastProvider } from '../components/ToastProvider';

/**
 * Root of the offline snapshot bundle. Deliberately mounts ONLY the public
 * pages — no admin routes, so the admin code (and its heavy deps: xlsx,
 * papaparse, react-hook-form, zod) is tree-shaken out of the viewer.
 *
 * Uses hash routing so deep links work from `file://` and from any static host
 * subpath without server rewrite rules. AuthProvider is included for context
 * parity (it's inert in snapshot mode — see SNAPSHOT_MODE guard).
 */
function RootLayout() {
  return (
    <ToastProvider>
      <Outlet />
      <CookieBanner />
    </ToastProvider>
  );
}

const router = createHashRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <EventViewPage /> },
      { path: '/:eventSlug', element: <EventViewPage /> },
      { path: '/:eventSlug/tent/:tentSlug', element: <EventViewPage /> },
      { path: '/impressum', element: <ImpressumPage /> },
      { path: '/datenschutz', element: <DatenschutzPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export default function SnapshotApp() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
