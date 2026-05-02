import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  cameraDownTiltAngle,
  SIGNPOST_THRESHOLD,
  SIGNPOST_HYSTERESIS,
} from '../../../../src/lib/three/cameraAngle';

function cameraLookingAt(eye: [number, number, number], target: [number, number, number]) {
  const cam = new THREE.PerspectiveCamera();
  cam.position.set(...eye);
  cam.lookAt(...target);
  cam.updateMatrixWorld();
  return cam;
}

describe('cameraDownTiltAngle', () => {
  // Precision 3 = within ~0.001 rad (0.06°). Three.js's getWorldDirection
  // round-trips through a matrix4 and back; small drift on extreme cardinal
  // directions is normal and doesn't affect mode-switching with a 0.03 rad
  // hysteresis band.
  it('returns ~0 when the camera looks straight down', () => {
    const cam = cameraLookingAt([0, 10, 0], [0, 0, 0]);
    expect(cameraDownTiltAngle(cam)).toBeCloseTo(0, 3);
  });

  it('returns ~PI/2 when the camera looks horizontally (eye-level)', () => {
    const cam = cameraLookingAt([10, 0, 0], [0, 0, 0]);
    expect(cameraDownTiltAngle(cam)).toBeCloseTo(Math.PI / 2, 3);
  });

  it('returns ~PI/4 when the camera looks down at a 45° angle', () => {
    const cam = cameraLookingAt([10, 10, 0], [0, 0, 0]);
    expect(cameraDownTiltAngle(cam)).toBeCloseTo(Math.PI / 4, 3);
  });

  it('is independent of where in the world the camera is — only orientation matters', () => {
    const a = cameraLookingAt([0, 100, 0], [0, 0, 0]);
    const b = cameraLookingAt([500, 100, 500], [500, 0, 500]);
    // Both look straight down. Different positions, same tilt.
    expect(cameraDownTiltAngle(a)).toBeCloseTo(cameraDownTiltAngle(b), 3);
  });

  it('exposes SIGNPOST_THRESHOLD at PI/3 (60° from straight-down = 30° from horizontal)', () => {
    expect(SIGNPOST_THRESHOLD).toBeCloseTo(Math.PI / 3, 6);
  });

  it('exposes SIGNPOST_HYSTERESIS as a small positive band', () => {
    expect(SIGNPOST_HYSTERESIS).toBeGreaterThan(0);
    expect(SIGNPOST_HYSTERESIS).toBeLessThan(0.1);
  });
});
