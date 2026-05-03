import * as THREE from 'three';
import type { CameraDefault } from './cameraDefault';

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
