import { createBrowserRouter } from 'react-router-dom';
import EventViewPage from './pages/public/EventViewPage';
import ImpressumPage from './pages/public/ImpressumPage';
import DatenschutzPage from './pages/public/DatenschutzPage';
import NotFoundPage from './pages/public/NotFoundPage';

export const router = createBrowserRouter([
  { path: '/', element: <EventViewPage /> },
  { path: '/:eventSlug', element: <EventViewPage /> },
  { path: '/:eventSlug/tent/:tentSlug', element: <EventViewPage /> },
  { path: '/impressum', element: <ImpressumPage /> },
  { path: '/datenschutz', element: <DatenschutzPage /> },
  { path: '*', element: <NotFoundPage /> },
]);
