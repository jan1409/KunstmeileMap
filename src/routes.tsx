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
