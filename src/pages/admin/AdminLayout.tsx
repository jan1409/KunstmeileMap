import { Link, Outlet, useMatch, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../components/AuthProvider';
import { useToast } from '../../components/ToastProvider';
import { LanguageToggle } from '../../components/LanguageToggle';
import { useEvent } from '../../hooks/useEvent';
import { useEventPermissions } from '../../hooks/useEventPermissions';

export default function AdminLayout() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { showError } = useToast();

  const eventMatch = useMatch('/admin/events/:eventSlug/*');
  const eventSlugInRoute = eventMatch?.params?.eventSlug;
  const { event: routeEvent } = useEvent(eventSlugInRoute);
  const eventPerms = useEventPermissions(routeEvent?.id);
  const showUsersLink = eventPerms.canOwn;

  async function onSignOut() {
    try {
      await signOut();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      showError(t('admin.nav.sign_out_failed', { message: msg }));
    }
    navigate('/admin/login', { replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only rounded bg-white/10 p-2 text-sm focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50"
      >
        {t('admin.nav.skip_to_main')}
      </a>
      <header className="flex items-center justify-between border-b border-white/10 p-4">
        <nav className="flex gap-4 text-sm">
          <Link to="/admin">{t('admin.nav.dashboard')}</Link>
          <Link to="/admin/events">{t('admin.nav.events')}</Link>
          {showUsersLink && eventSlugInRoute && (
            <Link to={`/admin/events/${eventSlugInRoute}/users`}>
              {t('admin.nav.users')}
            </Link>
          )}
          <Link to="/" className="text-white/70 hover:text-white">
            ↗ {t('admin.nav.view_site')}
          </Link>
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <LanguageToggle />
          <span className="text-white/60">{user?.email}</span>
          <button
            onClick={onSignOut}
            className="rounded bg-white/10 px-2 py-1"
          >
            {t('admin.nav.sign_out')}
          </button>
        </div>
      </header>
      <main id="main" className="flex-1 p-6"><Outlet /></main>
    </div>
  );
}
