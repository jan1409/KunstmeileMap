import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../components/AuthProvider';

export default function AdminLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  async function onSignOut() {
    try {
      await signOut();
    } catch (err) {
      console.warn('Sign out failed:', err);
    }
    navigate('/admin/login', { replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only rounded bg-white/10 p-2 text-sm focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50"
      >
        Skip to main content
      </a>
      <header className="flex items-center justify-between border-b border-white/10 p-4">
        <nav className="flex gap-4 text-sm">
          <Link to="/admin">Dashboard</Link>
          <Link to="/admin/events">Events</Link>
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-white/60">{user?.email}</span>
          <button
            onClick={onSignOut}
            className="rounded bg-white/10 px-2 py-1"
          >
            Sign out
          </button>
        </div>
      </header>
      <main id="main" className="flex-1 p-6"><Outlet /></main>
    </div>
  );
}
