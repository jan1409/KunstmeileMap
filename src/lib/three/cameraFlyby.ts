import * as THREE from 'three';
import type { CameraDefault } from './cameraDefault';

export class FlyCancelledError extends Error {
  constructor() {
    super('flyTo cancelled');
    this.name = 'FlyCancelledError';
  }
}

export interface OrbitControlsLike {
  target: THREE.Vector3;
  enabled: boolean;
  enableDamping: boolean;
  update: () => void;
}

export type FrameHookRegistrar = (cb: (deltaMs: number) => void) => () => void;

export interface FlyToOptions {
  /** default 1000 — chosen for "intentional, not snappy" feel. */
  durationMs?: number;
  /** default cubic ease-in-out. Pure function on [0,1]. */
  easing?: (t: number) => number;
}

export interface FlyToHandle {
  /** Resolves on completion, rejects with FlyCancelledError on cancel. */
  promise: Promise<void>;
  cancel: () => void;
}

const DEFAULT_DURATION_MS = 1000;
const cubicEaseInOut = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/**
 * Animate a camera + OrbitControls pair from their current pose to `endPose`
 * over `durationMs`. The animation is driven by `addFrameHook` (typically
 * `SplatSceneHandle.addFrameHook`), so the caller's existing render loop
 * advances the tween.
 *
 * While the animation is running:
 *   - controls.enabled is set to false (block user input)
 *   - controls.enableDamping is set to false (avoid post-tween drift)
 * Both are restored on completion or cancellation.
 *
 * Spherical interpolation: the function reads the current spherical state
 * around the *current* target and tweens (radius, phi, theta) plus the
 * target Vector3 — produces a more natural arc than lerping position
 * vectors directly.
 */
export function flyTo(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControlsLike,
  addFrameHook: FrameHookRegistrar,
  endPose: CameraDefault,
  opts: FlyToOptions = {},
): FlyToHandle {
  const durationMs = opts.durationMs ?? DEFAULT_DURATION_MS;
  const easing = opts.easing ?? cubicEaseInOut;

  // Snapshot current state.
  const target0 = controls.target.clone();
  const offset0 = new THREE.Vector3().subVectors(camera.position, controls.target);
  const sph0 = new THREE.Spherical().setFromVector3(offset0);

  const target1 = new THREE.Vector3(endPose.target.x, endPose.target.y, endPose.target.z);
  const offset1 = new THREE.Vector3(
    endPose.position.x - endPose.target.x,
    endPose.position.y - endPose.target.y,
    endPose.position.z - endPose.target.z,
  );
  const sph1 = new THREE.Spherical().setFromVector3(offset1);

  // Save state to restore on completion/cancel.
  const wasEnabled = controls.enabled;
  const wasDamping = controls.enableDamping;
  controls.enabled = false;
  controls.enableDamping = false;

  let elapsed = 0;
  let resolved = false;
  let cancelled = false;
  let resolveFn!: () => void;
  let rejectFn!: (err: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolveFn = res;
    rejectFn = rej;
  });
  // Cancellation is a normal control-flow outcome, not an error from the
  // caller's perspective. Attach a no-op rejection handler so callers that
  // don't await or .catch still get a clean shutdown — and Vitest doesn't
  // complain about an unhandled rejection in tests that intentionally cancel.
  promise.catch(() => {});

  const restore = () => {
    controls.enabled = wasEnabled;
    controls.enableDamping = wasDamping;
  };

  let removeHook: () => void = () => {};

  const tick = (deltaMs: number) => {
    if (resolved || cancelled) return;
    elapsed += deltaMs;
    const t = Math.min(1, elapsed / durationMs);
    const e = easing(t);

    const radius = sph0.radius + (sph1.radius - sph0.radius) * e;
    const phi = sph0.phi + (sph1.phi - sph0.phi) * e;
    // Wrap-aware theta lerp: take the shortest path around the circle.
    let dTheta = sph1.theta - sph0.theta;
    if (dTheta > Math.PI) dTheta -= 2 * Math.PI;
    if (dTheta < -Math.PI) dTheta += 2 * Math.PI;
    const theta = sph0.theta + dTheta * e;

    const newOffset = new THREE.Vector3().setFromSpherical(
      new THREE.Spherical(radius, phi, theta),
    );
    const newTarget = new THREE.Vector3().lerpVectors(target0, target1, e);

    controls.target.copy(newTarget);
    camera.position.copy(newTarget).add(newOffset);
    camera.lookAt(controls.target);

    if (t >= 1) {
      resolved = true;
      restore();
      removeHook();
      resolveFn();
    }
  };

  removeHook = addFrameHook(tick);

  const cancel = () => {
    if (resolved || cancelled) return;
    cancelled = true;
    restore();
    removeHook();
    rejectFn(new FlyCancelledError());
  };

  return { promise, cancel };
}

// TODO(per-event-config): expose these via events.splat_camera_default_landing
// once the admin UI grows the controls. Tracked in deferred-items.
export const LANDING_DISTANCE_M = 10;
export const MIN_LANDING_POLAR = THREE.MathUtils.degToRad(40);
export const MAX_LANDING_POLAR = THREE.MathUtils.degToRad(75);

/**
 * Compute a "land here" pose for the camera given the current pose and a
 * tent position. Preserves the current azimuth, clamps polar to
 * [MIN_LANDING_POLAR, MAX_LANDING_POLAR], and sets distance to
 * LANDING_DISTANCE_M from the tent.
 */
export function computeLandingPose(
  currentCamera: THREE.PerspectiveCamera,
  currentTarget: THREE.Vector3,
  tentPosition: { x: number; y: number; z: number },
): CameraDefault {
  const offset = new THREE.Vector3().subVectors(currentCamera.position, currentTarget);
  const sph = new THREE.Spherical().setFromVector3(offset);

  const phi = THREE.MathUtils.clamp(sph.phi, MIN_LANDING_POLAR, MAX_LANDING_POLAR);
  const theta = sph.theta;
  const radius = LANDING_DISTANCE_M;

  const newOffset = new THREE.Vector3().setFromSpherical(new THREE.Spherical(radius, phi, theta));
  const targetVec = new THREE.Vector3(tentPosition.x, tentPosition.y, tentPosition.z);
  const positionVec = new THREE.Vector3().addVectors(targetVec, newOffset);

  return {
    position: { x: positionVec.x, y: positionVec.y, z: positionVec.z },
    target: { x: targetVec.x, y: targetVec.y, z: targetVec.z },
  };
}
