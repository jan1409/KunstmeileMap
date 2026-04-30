import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { useProfile } from '../hooks/useProfile';

export function RequireAuth({ children }: { children: ReactElement }) {
  const { session, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile(session?.user.id);
  const loc = useLocation();

  if (authLoading) return <div className="p-6 text-white/60">…</div>;
  if (!session) return <Navigate to="/admin/login" state={{ from: loc }} replace />;
  if (profileLoading) return <div className="p-6 text-white/60">…</div>;
  if (profile?.role !== 'admin') return <Navigate to="/admin/no-access" replace />;
  return children;
}
