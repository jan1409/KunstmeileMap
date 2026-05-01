import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import * as THREE from 'three';

const useAuthMock = vi.fn();
vi.mock('../../../src/components/AuthProvider', () => ({
  useAuth: () => useAuthMock(),
}));

const useProfileMock = vi.fn();
vi.mock('../../../src/hooks/useProfile', () => ({
  useProfile: (userId: string | undefined) => useProfileMock(userId),
}));

const updateEq = vi.fn();
const update = vi.fn(() => ({ eq: updateEq }));
vi.mock('../../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({ update })),
  },
}));

import { SetCameraDefaultButton } from '../../../src/components/SetCameraDefaultButton';
import type { SplatSceneHandle } from '../../../src/lib/three/SplatScene';

const adminProfile = { id: 'u1', role: 'admin' as const, full_name: null, created_at: '' };
const editorProfile = { id: 'u2', role: 'editor' as const, full_name: null, created_at: '' };

function makeHandle(
  position: [number, number, number],
  target: [number, number, number],
): SplatSceneHandle {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(...position);
  const controls = {
    target: new THREE.Vector3(...target),
    update: vi.fn(),
  };
  // Cast: SplatSceneHandle has more fields (scene, renderer, splatMesh, spark)
  // that the button does not touch — the mock just needs camera + controls.
  return { camera, controls } as unknown as SplatSceneHandle;
}

describe('SetCameraDefaultButton', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    useProfileMock.mockReset();
    update.mockClear();
    updateEq.mockReset();
    updateEq.mockResolvedValue({ data: null, error: null });
  });

  it('renders nothing for visitors with no session', () => {
    useAuthMock.mockReturnValue({ session: null });
    useProfileMock.mockReturnValue({ profile: null, loading: false, error: null });

    const ref = createRef<SplatSceneHandle | null>();
    const { container } = render(<SetCameraDefaultButton eventId="evt-1" sceneHandleRef={ref} />);

    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for an authenticated editor (non-admin)', () => {
    useAuthMock.mockReturnValue({ session: { user: { id: 'u2' } } });
    useProfileMock.mockReturnValue({ profile: editorProfile, loading: false, error: null });

    const ref = createRef<SplatSceneHandle | null>();
    const { container } = render(<SetCameraDefaultButton eventId="evt-1" sceneHandleRef={ref} />);

    expect(container.firstChild).toBeNull();
  });

  it('renders the save button for an admin', () => {
    useAuthMock.mockReturnValue({ session: { user: { id: 'u1' } } });
    useProfileMock.mockReturnValue({ profile: adminProfile, loading: false, error: null });

    const ref = createRef<SplatSceneHandle | null>();
    render(<SetCameraDefaultButton eventId="evt-1" sceneHandleRef={ref} />);

    expect(screen.getByRole('button', { name: /save current view as default/i })).toBeInTheDocument();
  });

  it('captures camera + target and writes the JSON to events.splat_camera_default on click', async () => {
    useAuthMock.mockReturnValue({ session: { user: { id: 'u1' } } });
    useProfileMock.mockReturnValue({ profile: adminProfile, loading: false, error: null });

    const handle = makeHandle([10, 5, -2], [0, 0, 0]);
    const ref = { current: handle };
    const user = userEvent.setup();
    render(<SetCameraDefaultButton eventId="evt-42" sceneHandleRef={ref} />);

    await user.click(screen.getByRole('button', { name: /save current view as default/i }));

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update).toHaveBeenCalledWith({
      splat_camera_default: {
        position: { x: 10, y: 5, z: -2 },
        target: { x: 0, y: 0, z: 0 },
      },
    });
    expect(updateEq).toHaveBeenCalledWith('id', 'evt-42');

    expect(await screen.findByText(/saved\./i)).toBeInTheDocument();
  });

  it('surfaces the error message when supabase update fails', async () => {
    useAuthMock.mockReturnValue({ session: { user: { id: 'u1' } } });
    useProfileMock.mockReturnValue({ profile: adminProfile, loading: false, error: null });
    updateEq.mockResolvedValueOnce({ data: null, error: { message: 'rls denied events' } });

    const handle = makeHandle([1, 2, 3], [4, 5, 6]);
    const ref = { current: handle };
    const user = userEvent.setup();
    render(<SetCameraDefaultButton eventId="evt-1" sceneHandleRef={ref} />);

    await user.click(screen.getByRole('button', { name: /save current view as default/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/rls denied events/i);
    expect(screen.queryByText(/^saved\./i)).not.toBeInTheDocument();
  });

  it('does nothing when the scene handle ref is null (scene not yet ready)', async () => {
    useAuthMock.mockReturnValue({ session: { user: { id: 'u1' } } });
    useProfileMock.mockReturnValue({ profile: adminProfile, loading: false, error: null });

    const ref = createRef<SplatSceneHandle | null>();
    const user = userEvent.setup();
    render(<SetCameraDefaultButton eventId="evt-1" sceneHandleRef={ref} />);

    await user.click(screen.getByRole('button', { name: /save current view as default/i }));

    expect(update).not.toHaveBeenCalled();
  });
});
