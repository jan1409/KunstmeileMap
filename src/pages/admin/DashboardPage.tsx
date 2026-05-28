import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../components/AuthProvider';
import { useProfile } from '../../hooks/useProfile';

export default function DashboardPage() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const { profile, loading } = useProfile(session?.user?.id);

  if (loading) {
    return (
      <p role="status" aria-live="polite" className="p-6">
        {t('app.auth_loading')}
      </p>
    );
  }
  if (profile?.role !== 'admin') return <Navigate to="/admin/events" replace />;

  return (
    <div>
      <h1 className="text-2xl font-semibold">{t('admin.dashboard.heading')}</h1>
      <p className="mt-2 text-white/60">{t('admin.dashboard.quick_actions')}</p>
      <ul className="mt-2 list-disc pl-6 text-sm">
        <li><Link to="/admin/events" className="underline">{t('admin.dashboard.manage_events')}</Link></li>
      </ul>
    </div>
  );
}
