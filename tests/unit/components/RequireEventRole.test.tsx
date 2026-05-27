import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RequireEventRole } from '../../../src/components/RequireEventRole';

const permissionsState = vi.fn();
vi.mock('../../../src/hooks/useEventPermissions', () => ({
  useEventPermissions: (...args: unknown[]) => permissionsState(...args),
}));

const eventState = vi.fn();
vi.mock('../../../src/hooks/useEvent', () => ({
  useEvent: (...args: unknown[]) => eventState(...args),
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/admin/events/:eventSlug/protected"
          element={
            <RequireEventRole minRole="editor">
              <div>protected content</div>
            </RequireEventRole>
          }
        />
        <Route path="/admin/events/:eventSlug/tents" element={<div>redirect target</div>} />
        <Route path="/admin/no-access" element={<div>no-access page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireEventRole', () => {
  beforeEach(() => {
    permissionsState.mockReset();
    eventState.mockReset();
  });

  it('renders a loading state while event or permissions are still loading', () => {
    eventState.mockReturnValue({ event: null, loading: true, error: null });
    permissionsState.mockReturnValue({ loading: true, canAccess: false, canContribute: false, canEdit: false, canOwn: false });
    renderAt('/admin/events/foo/protected');
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  it('renders children when the caller meets the minRole', () => {
    eventState.mockReturnValue({ event: { id: 'ev1', slug: 'foo' }, loading: false, error: null });
    permissionsState.mockReturnValue({ loading: false, canAccess: true, canContribute: true, canEdit: true, canOwn: false });
    renderAt('/admin/events/foo/protected');
    expect(screen.getByText('protected content')).toBeInTheDocument();
  });

  it('redirects to /admin/events/:slug/tents when the caller lacks the minRole but can access the event', () => {
    eventState.mockReturnValue({ event: { id: 'ev1', slug: 'foo' }, loading: false, error: null });
    permissionsState.mockReturnValue({ loading: false, canAccess: true, canContribute: true, canEdit: false, canOwn: false });
    renderAt('/admin/events/foo/protected');
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
    expect(screen.getByText('redirect target')).toBeInTheDocument();
  });

  it('redirects to /admin/no-access when the caller has no access to the event at all', () => {
    eventState.mockReturnValue({ event: { id: 'ev1', slug: 'foo' }, loading: false, error: null });
    permissionsState.mockReturnValue({ loading: false, canAccess: false, canContribute: false, canEdit: false, canOwn: false });
    renderAt('/admin/events/foo/protected');
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
    expect(screen.getByText('no-access page')).toBeInTheDocument();
  });
});
