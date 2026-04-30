import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export function RequireAuth({ children }: { children: ReactElement }) {
  const { session, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="p-6 text-white/60">…</div>;
  if (!session) return <Navigate to="/admin/login" state={{ from: loc }} replace />;
  return children;
}
