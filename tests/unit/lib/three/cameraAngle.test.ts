import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  polarAngleFromUp,
  SIGNPOST_THRESHOLD,
  SIGNPOST_HYSTERESIS,
} from '../../../../src/lib/three/cameraAngle';

const point = new THREE.Vector3(0, 0, 0);

describe('polarAngleFromUp', () => {
  it('returns ~0 when the camera is directly above the point', () => {
    const cam = new THREE.Vector3(0, 10, 0);
    expect(polarAngleFromUp(cam, point)).toBeCloseTo(0, 6);
  });

  it('returns ~PI/2 when the camera is at the same height as the point', () => {
    const cam = new THREE.Vector3(10, 0, 0);
    expect(polarAngleFromUp(cam, point)).toBeCloseTo(Math.PI / 2, 6);
  });

  it('returns ~PI when the camera is directly below the point', () => {
    const cam = new THREE.Vector3(0, -10, 0);
    expect(polarAngleFromUp(cam, point)).toBeCloseTo(Math.PI, 6);
  });

  it('returns 0 (degenerate fallback) when the camera is at the same position as the point', () => {
    const cam = new THREE.Vector3(0, 0, 0);
    expect(polarAngleFromUp(cam, point)).toBe(0);
  });

  it('returns an angle between 0 and PI/2 for a camera that is above and offset', () => {
    const cam = new THREE.Vector3(5, 5, 0); // 45 degrees from up
    const angle = polarAngleFromUp(cam, point);
    expect(angle).toBeGreaterThan(0);
    expect(angle).toBeLessThan(Math.PI / 2);
    expect(angle).toBeCloseTo(Math.PI / 4, 6);
  });

  it('exposes the SIGNPOST_THRESHOLD constant at PI/4 with a small hysteresis band', () => {
    expect(SIGNPOST_THRESHOLD).toBeCloseTo(Math.PI / 4, 6);
    expect(SIGNPOST_HYSTERESIS).toBeGreaterThan(0);
    expect(SIGNPOST_HYSTERESIS).toBeLessThan(0.1);
  });
});
