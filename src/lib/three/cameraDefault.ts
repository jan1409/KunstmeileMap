import * as THREE from 'three';
import { z } from 'zod';

const xyz = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite(),
});

export const cameraDefaultSchema = z.object({
  position: xyz,
  target: xyz,
});

export type CameraDefault = z.infer<typeof cameraDefaultSchema>;

export const FALLBACK_CAMERA: CameraDefault = {
  position: { x: 0, y: 0, z: 8 },
  target: { x: 0, y: 0, z: 0 },
};

// Minimal interface so tests can pass a stub instead of constructing a full
// OrbitControls (which pulls DOM-heavy dependencies). Real OrbitControls
// matches this shape.
export interface ControlsLike {
  target: THREE.Vector3;
  update: () => void;
}

/**
 * Apply a camera default to a PerspectiveCamera + OrbitControls pair. Falls
 * back to FALLBACK_CAMERA when `cd` is null/undefined so callers can blindly
 * pipe the parsed jsonb through.
 */
export function applyCameraDefault(
  camera: THREE.PerspectiveCamera,
  controls: ControlsLike,
  cd: CameraDefault | null | undefined,
): void {
  const c = cd ?? FALLBACK_CAMERA;
  camera.position.set(c.position.x, c.position.y, c.position.z);
  controls.target.set(c.target.x, c.target.y, c.target.z);
  camera.lookAt(c.target.x, c.target.y, c.target.z);
  controls.update();
}

/**
 * Read the current camera state into the JSON shape stored in
 * events.splat_camera_default.
 */
export function readCameraDefault(
  camera: THREE.PerspectiveCamera,
  controls: ControlsLike,
): CameraDefault {
  return {
    position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
    target: { x: controls.target.x, y: controls.target.y, z: controls.target.z },
  };
}

/**
 * Validate an unknown jsonb value (e.g. a `Database['public']['Tables']['events']['Row']
 * ['splat_camera_default']`) into a `CameraDefault` or `null`.
 */
export function parseCameraDefault(value: unknown): CameraDefault | null {
  if (value == null) return null;
  const result = cameraDefaultSchema.safeParse(value);
  return result.success ? result.data : null;
}
