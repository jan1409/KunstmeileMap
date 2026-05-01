import type { ReactElement } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthProvider';
import { useProfile } from '../hooks/useProfile';

function LoadingPlaceholder({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen items-center justify-center bg-neutral-900 p-6 text-white"
    >
      {label}
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactElement }) {
  const { session, loading: authLoading, signOut } = useAuth();
  const { profile, loading: profileLoading, error: profileError } = useProfile(
    session?.user.id,
  );
  const loc = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  async function handleSignOut() {
    try {
      await signOut();
    } catch (err) {
      console.warn('Sign out failed:', err);
    }
    navigate('/admin/login', { replace: true });
  }

  if (authLoading) return <LoadingPlaceholder label={t('app.auth_loading')} />;
  if (!session) return <Navigate to="/admin/login" state={{ from: loc }} replace />;
  if (profileLoading) return <LoadingPlaceholder label={t('app.auth_loading')} />;
  if (profileError) {
    return (
      <main
        role="alert"
        className="mx-auto flex min-h-screen max-w-md flex-col items-start justify-center gap-4 p-6 text-white"
      >
        <h1 className="text-xl font-semibold">{t('app.auth_profile_error')}</h1>
        <p className="text-sm text-white/70">{profileError.message}</p>
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
  if (profile?.role !== 'admin') return <Navigate to="/admin/no-access" replace />;
  return children;
}
