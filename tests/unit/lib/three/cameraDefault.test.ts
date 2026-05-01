import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';

import {
  FALLBACK_CAMERA,
  applyCameraDefault,
  parseCameraDefault,
  readCameraDefault,
  type ControlsLike,
} from '../../../../src/lib/three/cameraDefault';

function makeControls() {
  return {
    target: new THREE.Vector3(),
    update: vi.fn(),
  } satisfies ControlsLike;
}

describe('parseCameraDefault', () => {
  it('returns null for null/undefined', () => {
    expect(parseCameraDefault(null)).toBeNull();
    expect(parseCameraDefault(undefined)).toBeNull();
  });

  it('returns null for malformed payloads', () => {
    expect(parseCameraDefault({})).toBeNull();
    expect(parseCameraDefault({ position: { x: 1, y: 2 } })).toBeNull();
    expect(parseCameraDefault({ position: { x: 'bad', y: 0, z: 0 }, target: { x: 0, y: 0, z: 0 } })).toBeNull();
    expect(
      parseCameraDefault({
        position: { x: Number.POSITIVE_INFINITY, y: 0, z: 0 },
        target: { x: 0, y: 0, z: 0 },
      }),
    ).toBeNull();
  });

  it('returns the typed payload for valid input', () => {
    const valid = {
      position: { x: 1, y: 2, z: 3 },
      target: { x: 4, y: 5, z: 6 },
    };
    expect(parseCameraDefault(valid)).toEqual(valid);
  });
});

describe('applyCameraDefault', () => {
  it('positions camera, sets controls.target, and points the camera at target', () => {
    const camera = new THREE.PerspectiveCamera();
    const controls = makeControls();

    applyCameraDefault(camera, controls, {
      position: { x: 10, y: 5, z: -2 },
      target: { x: 0, y: 0, z: 0 },
    });

    expect(camera.position.x).toBe(10);
    expect(camera.position.y).toBe(5);
    expect(camera.position.z).toBe(-2);
    expect(controls.target.x).toBe(0);
    expect(controls.target.y).toBe(0);
    expect(controls.target.z).toBe(0);
    expect(controls.update).toHaveBeenCalledTimes(1);

    // Camera should look toward the target — verify the forward vector points
    // roughly from camera toward target.
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const expected = new THREE.Vector3(0, 0, 0).sub(camera.position).normalize();
    expect(forward.dot(expected)).toBeGreaterThan(0.99);
  });

  it('falls back to FALLBACK_CAMERA when cd is null/undefined', () => {
    const camera = new THREE.PerspectiveCamera();
    const controls = makeControls();

    applyCameraDefault(camera, controls, null);

    expect(camera.position.x).toBe(FALLBACK_CAMERA.position.x);
    expect(camera.position.y).toBe(FALLBACK_CAMERA.position.y);
    expect(camera.position.z).toBe(FALLBACK_CAMERA.position.z);
    expect(controls.target.x).toBe(FALLBACK_CAMERA.target.x);
    expect(controls.update).toHaveBeenCalled();
  });
});

describe('readCameraDefault', () => {
  it('captures camera position + controls.target into the JSON shape', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(7, 8, 9);
    const controls = makeControls();
    controls.target.set(1, 2, 3);

    expect(readCameraDefault(camera, controls)).toEqual({
      position: { x: 7, y: 8, z: 9 },
      target: { x: 1, y: 2, z: 3 },
    });
  });

  it('round-trips through applyCameraDefault', () => {
    const camera = new THREE.PerspectiveCamera();
    const controls = makeControls();
    const cd = { position: { x: 12, y: -3, z: 0.5 }, target: { x: 1.5, y: 0, z: 1.5 } };

    applyCameraDefault(camera, controls, cd);
    const captured = readCameraDefault(camera, controls);

    expect(captured).toEqual(cd);
  });
});
