import { createBrowserRouter } from 'react-router-dom';
import EventViewPage from './pages/public/EventViewPage';
import ImpressumPage from './pages/public/ImpressumPage';
import DatenschutzPage from './pages/public/DatenschutzPage';
import NotFoundPage from './pages/public/NotFoundPage';
import LoginPage from './pages/admin/LoginPage';
import DashboardPage from './pages/admin/DashboardPage';
import EventListPage from './pages/admin/EventListPage';
import TentListPage from './pages/admin/TentListPage';
import TentEditPage from './pages/admin/TentEditPage';
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
      { path: 'events', element: <EventListPage /> },
      { path: 'events/:eventSlug/tents', element: <TentListPage /> },
      { path: 'events/:eventSlug/tents/new', element: <TentEditPage /> },
      { path: 'events/:eventSlug/tents/:tentId', element: <TentEditPage /> },
      // category routes added in later A3 tasks
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
