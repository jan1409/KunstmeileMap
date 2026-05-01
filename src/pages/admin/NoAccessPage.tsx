import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../components/AuthProvider';
import { useToast } from '../../components/ToastProvider';

export default function NoAccessPage() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { showError } = useToast();

  async function handleSignOut() {
    try {
      await signOut();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      showError(`Sign out failed: ${msg}`);
    }
    navigate('/admin/login', { replace: true });
  }

  return (
    <main className="mx-auto max-w-md p-6 text-white">
      <h1 className="mb-4 text-2xl font-semibold">{t('no_access.title')}</h1>
      <p className="mb-6 text-sm text-white/80">{t('no_access.body')}</p>
      <button
        type="button"
        onClick={handleSignOut}
        className="rounded bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
      >
        {t('no_access.sign_out')}
      </button>
    </main>
  );
}
