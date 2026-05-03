import * as THREE from 'three';

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
