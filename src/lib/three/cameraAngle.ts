import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const tmp = new THREE.Vector3();

/**
 * Polar angle (in radians) between the world up vector and the line from
 * `point` to `cameraPosition`. 0 = camera directly above the point;
 * Math.PI/2 = camera at the same height as the point. Used to switch
 * between top-down (flat sprite) and ground-level (3D sign-post) marker
 * rendering.
 */
export function polarAngleFromUp(
  cameraPosition: THREE.Vector3,
  point: THREE.Vector3,
): number {
  tmp.subVectors(cameraPosition, point);
  if (tmp.lengthSq() === 0) return 0;
  return tmp.angleTo(UP);
}

/**
 * Threshold (radians) at which the marker switches between flat sprite
 * (below threshold) and 3D sign-post (above threshold). 45° from world-up.
 */
export const SIGNPOST_THRESHOLD = Math.PI / 4;

/**
 * Hysteresis band (radians) around SIGNPOST_THRESHOLD. The marker only
 * transitions to sign-post when polar > threshold + HYSTERESIS, and back
 * to flat when polar < threshold - HYSTERESIS. Eliminates flicker right
 * at the threshold during slow camera tilts.
 */
export const SIGNPOST_HYSTERESIS = 0.03;
