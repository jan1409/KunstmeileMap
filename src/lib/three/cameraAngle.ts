import * as THREE from 'three';

const fwd = new THREE.Vector3();

/**
 * Angle (in radians) between the camera's view direction and the world
 * straight-down vector (0,-1,0). Camera-global; identical for every marker
 * in the scene. Used to switch between flat-sprite (top-down) and
 * sign-post (more horizontal) marker rendering.
 *
 * Convention:
 *   0     = camera looks straight down (top-down map view)
 *   PI/2  = camera looks horizontal (eye-level walk-through view)
 *   PI    = camera looks straight up (rare; clamped by OrbitControls.maxPolarAngle)
 *
 * NOTE: an earlier version computed the angle PER MARKER from the camera's
 * position to each marker's position. That was wrong: in a top-down view
 * across a wide scene, markers far off to the side had large angles
 * (because the camera-to-marker line is itself slanted) and would flip into
 * sign-post mode while the camera was still looking nearly straight down,
 * making them disappear or render as tiny posts in the distance. Using the
 * camera's own world-direction makes the mode switch global to the camera,
 * not local to each marker.
 */
export function cameraDownTiltAngle(camera: THREE.Camera): number {
  camera.getWorldDirection(fwd);
  // -fwd.y = projection of view direction onto world-up.
  // Looking straight down → fwd.y = -1 → -fwd.y = 1 → acos(1) = 0.
  // Looking horizontal   → fwd.y =  0 → -fwd.y = 0 → acos(0) = PI/2.
  // Clamp guards against floating-point drift outside [-1, 1].
  const dot = Math.max(-1, Math.min(1, -fwd.y));
  return Math.acos(dot);
}

/**
 * Threshold (radians) at which the marker switches between flat sprite
 * (below threshold — camera still mostly top-down) and 3D sign-post
 * (above threshold — camera near horizontal).
 *
 * PI/3 = 60° from straight-down = 30° from horizontal. The marker only
 * becomes a sign-post once the camera has tilted within 30° of horizontal,
 * so the flat top-down view stays clean during normal browsing.
 */
export const SIGNPOST_THRESHOLD = Math.PI / 3;

/**
 * Hysteresis band (radians) around SIGNPOST_THRESHOLD. The marker only
 * transitions to sign-post when angle > threshold + HYSTERESIS, and back
 * to flat when angle < threshold - HYSTERESIS. Eliminates flicker right
 * at the threshold during slow camera tilts.
 */
export const SIGNPOST_HYSTERESIS = 0.03;
