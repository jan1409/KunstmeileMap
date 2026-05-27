import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function DashboardPage() {
  const { t } = useTranslation();
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
