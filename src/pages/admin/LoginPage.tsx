import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation, type Location } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../components/AuthProvider';

interface LocationState {
  from?: Location;
}

export default function LoginPage() {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await signIn(email, password);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    const state = loc.state as LocationState | null;
    const from = state?.from;
    navigate(
      from
        ? { pathname: from.pathname, search: from.search, hash: from.hash }
        : '/admin',
      { replace: true },
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">{t('admin.login.heading')}</h1>
        <label className="block">
          <span className="sr-only">{t('admin.login.email_label')}</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('admin.login.email_placeholder')}
            className="w-full rounded bg-white/10 p-2 text-white"
          />
        </label>
        <label className="block">
          <span className="sr-only">{t('admin.login.password_label')}</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('admin.login.password_placeholder')}
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
          {busy ? t('admin.login.submitting') : t('admin.login.submit')}
        </button>
      </form>
    </main>
  );
}
