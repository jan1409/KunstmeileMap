import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../components/AuthProvider';
import { supabase } from '../../lib/supabase';

export default function WelcomePage() {
  const { t } = useTranslation();
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // PKCE returns ?code=...; legacy/implicit returns #access_token=...; errors
  // come back as ?error / ?error_description or in the hash.
  const hasAuthArtifact =
    searchParams.has('code') ||
    searchParams.has('error') ||
    searchParams.has('error_description') ||
    location.hash.includes('access_token') ||
    location.hash.includes('error');

  const [graceElapsed, setGraceElapsed] = useState(false);
  useEffect(() => {
    if (loading || session || !hasAuthArtifact) return;
    // PKCE code→session exchange is async; give it a moment before concluding
    // the link is invalid.
    const timer = setTimeout(() => setGraceElapsed(true), 4000);
    return () => clearTimeout(timer);
  }, [loading, session, hasAuthArtifact]);

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-screen items-center justify-center bg-neutral-900 p-6 text-white"
      >
        {t('app.auth_loading')}
      </div>
    );
  }

  if (!session && hasAuthArtifact && !graceElapsed) {
    // Mid-exchange: AuthProvider flipped loading=false before the async PKCE
    // code→session exchange finished. Keep waiting for onAuthStateChange.
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-screen items-center justify-center bg-neutral-900 p-6 text-white"
      >
        {t('app.auth_loading')}
      </div>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <p role="alert" className="text-sm text-red-400">
            {t('admin.welcome.invalid_session')}
          </p>
          <Link to="/admin/login" className="text-white underline">
            {t('admin.welcome.to_login')}
          </Link>
        </div>
      </main>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError(t('admin.welcome.password_mismatch'));
      return;
    }
    if (password.length < 8) {
      setError(t('admin.welcome.password_too_short'));
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError(t('admin.welcome.error', { message: err.message }));
      return;
    }
    navigate('/admin', { replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">{t('admin.welcome.heading')}</h1>
        <p className="text-sm text-white/70">{t('admin.welcome.intro')}</p>
        <label className="block">
          <span className="sr-only">{t('admin.welcome.password_label')}</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('admin.welcome.password_placeholder')}
            className="w-full rounded bg-white/10 p-2 text-white"
          />
        </label>
        <label className="block">
          <span className="sr-only">{t('admin.welcome.confirm_label')}</span>
          <input
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={t('admin.welcome.confirm_placeholder')}
            className="w-full rounded bg-white/10 p-2 text-white"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}
        <button
          disabled={busy}
          className="w-full rounded bg-white/20 p-2 hover:bg-white/30 disabled:opacity-50"
        >
          {busy ? t('admin.welcome.submitting') : t('admin.welcome.submit')}
        </button>
      </form>
    </main>
  );
}
