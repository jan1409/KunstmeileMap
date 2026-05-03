import * as THREE from 'three';
import type { FrameHookRegistrar } from './cameraFlyby';

// Per-event override deferred. Same pattern as the flyby's polar clamp.
export const EYE_HEIGHT_M = 1.7;
export const WALK_SPEED_M_PER_S = 3;
export const MAX_WALK_DURATION_MS = 4000;
export const GROUND_RESAMPLE_FRAMES = 5;
export const MIN_GROUND_NORMAL_Y = 0.6;
export const PITCH_LIMIT_RAD = THREE.MathUtils.degToRad(60);
export const SIGN_APPROACH_OFFSET_M = 2;

/**
 * Camera position for "stand here at eye level" given a ground hit.
 */
export function computeEyePose(groundHit: THREE.Vector3): THREE.Vector3 {
  return new THREE.Vector3(groundHit.x, groundHit.y + EYE_HEIGHT_M, groundHit.z);
}

/**
 * Walk animation duration for a given xz distance, capped at MAX_WALK_DURATION_MS.
 */
export function computeWalkDuration(distanceM: number): number {
  if (distanceM <= 0) return 0;
  return Math.min((distanceM / WALK_SPEED_M_PER_S) * 1000, MAX_WALK_DURATION_MS);
}

/**
 * True if the given hit normal points "up enough" to be considered ground
 * rather than a wall, tent roof, or tree canopy. The threshold MIN_GROUND_NORMAL_Y
 * (≈0.6) corresponds to surfaces tilted ≤ ~53° from horizontal.
 *
 * Expects a unit-length normal — Three.js raycast intersections always provide
 * one. The function does NOT normalize the input; callers passing a non-unit
 * vector will get incorrect results.
 */
export function isGroundLikeNormal(normal: THREE.Vector3): boolean {
  return normal.y >= MIN_GROUND_NORMAL_Y;
}

/**
 * Where to stop when auto-walking toward a sign: SIGN_APPROACH_OFFSET_M short
 * of it on the camera→sign xz line. Returns the original sign position
 * unchanged (well, with camera xz preserved) when the sign is closer than
 * the offset, so the caller's "auto-walk to here" becomes a no-op rather than
 * walking backwards.
 */
export function computeSignApproachTarget(
  cameraPos: THREE.Vector3,
  signPos: THREE.Vector3,
): THREE.Vector3 {
  const dx = signPos.x - cameraPos.x;
  const dz = signPos.z - cameraPos.z;
  const distXZ = Math.hypot(dx, dz);
  if (distXZ <= SIGN_APPROACH_OFFSET_M) {
    return new THREE.Vector3(cameraPos.x, signPos.y, cameraPos.z);
  }
  const stopFraction = (distXZ - SIGN_APPROACH_OFFSET_M) / distXZ;
  return new THREE.Vector3(
    cameraPos.x + dx * stopFraction,
    signPos.y,
    cameraPos.z + dz * stopFraction,
  );
}

/**
 * Clamp a pitch angle (radians) to ±PITCH_LIMIT_RAD.
 */
export function clampPitch(pitchRad: number): number {
  return THREE.MathUtils.clamp(pitchRad, -PITCH_LIMIT_RAD, PITCH_LIMIT_RAD);
}

export class WalkCancelledError extends Error {
  constructor() {
    super('walk cancelled');
    this.name = 'WalkCancelledError';
  }
}

/**
 * Returns the ground y for a given world (x, z). Walk-mode callers raycast
 * downward against the splat surface; tests pass a pure function. Returning
 * `null` means "no hit" — keep the previous y.
 */
export type GroundSampler = (x: number, z: number) => number | null;

export interface WalkAnimateOptions {
  /** Final xz position; y is sampled at every resample tick. */
  target: THREE.Vector3;
  /** Total duration in ms. Caller should derive from computeWalkDuration. */
  durationMs: number;
  /** Optional easing on [0,1]. Default: cubic ease-in-out. */
  easing?: (t: number) => number;
}

export interface WalkAnimateHandle {
  promise: Promise<void>;
  cancel: () => void;
}

const cubicEaseInOut = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/**
 * Linearly lerp camera xz from current position to `target.xz` over
 * `durationMs`. Camera y = ground sample at current xz + EYE_HEIGHT_M,
 * resampled every GROUND_RESAMPLE_FRAMES frames; lerped between samples.
 *
 * Unlike flyTo, this does NOT touch controls.target or camera.quaternion —
 * the caller (WalkModeController) manages look direction independently.
 */
export function walkAnimateTo(
  camera: THREE.PerspectiveCamera,
  addFrameHook: FrameHookRegistrar,
  sampleGround: GroundSampler,
  opts: WalkAnimateOptions,
): WalkAnimateHandle {
  const easing = opts.easing ?? cubicEaseInOut;
  const startX = camera.position.x;
  const startZ = camera.position.z;
  const targetX = opts.target.x;
  const targetZ = opts.target.z;

  let elapsed = 0;
  let frameCount = 0;
  let lastSampledY = camera.position.y - EYE_HEIGHT_M;
  let resolved = false;
  let cancelled = false;
  let resolveFn!: () => void;
  let rejectFn!: (err: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolveFn = res;
    rejectFn = rej;
  });
  promise.catch(() => {}); // see flyTo: cancellation is normal control flow

  let removeHook: () => void = () => {};

  const tick = (deltaMs: number) => {
    if (resolved || cancelled) return;
    elapsed += deltaMs;
    frameCount += 1;
    const t = opts.durationMs <= 0 ? 1 : Math.min(1, elapsed / opts.durationMs);
    const e = easing(t);

    const x = startX + (targetX - startX) * e;
    const z = startZ + (targetZ - startZ) * e;

    if (frameCount % GROUND_RESAMPLE_FRAMES === 0 || t >= 1) {
      const y = sampleGround(x, z);
      if (y != null) lastSampledY = y;
    }

    camera.position.set(x, lastSampledY + EYE_HEIGHT_M, z);

    if (t >= 1) {
      resolved = true;
      removeHook();
      resolveFn();
    }
  };

  removeHook = addFrameHook(tick);

  const cancel = () => {
    if (resolved || cancelled) return;
    cancelled = true;
    removeHook();
    rejectFn(new WalkCancelledError());
  };

  return { promise, cancel };
}
