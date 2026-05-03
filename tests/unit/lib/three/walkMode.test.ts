import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  computeEyePose,
  computeWalkDuration,
  isGroundLikeNormal,
  computeSignApproachTarget,
  clampPitch,
  EYE_HEIGHT_M,
  WALK_SPEED_M_PER_S,
  MAX_WALK_DURATION_MS,
  MIN_GROUND_NORMAL_Y,
  PITCH_LIMIT_RAD,
  SIGN_APPROACH_OFFSET_M,
} from '../../../../src/lib/three/walkMode';

describe('computeEyePose', () => {
  it('places the camera EYE_HEIGHT_M above the ground hit on the same xz', () => {
    const ground = new THREE.Vector3(3, 0.5, 4);
    const pose = computeEyePose(ground);
    expect(pose.x).toBe(3);
    expect(pose.y).toBeCloseTo(0.5 + EYE_HEIGHT_M, 5);
    expect(pose.z).toBe(4);
  });
});

describe('computeWalkDuration', () => {
  it('returns distance / WALK_SPEED_M_PER_S in milliseconds for short walks', () => {
    expect(computeWalkDuration(3)).toBeCloseTo((3 / WALK_SPEED_M_PER_S) * 1000, 5);
  });
  it('caps at MAX_WALK_DURATION_MS for long walks', () => {
    expect(computeWalkDuration(1000)).toBe(MAX_WALK_DURATION_MS);
  });
  it('returns 0 for zero distance', () => {
    expect(computeWalkDuration(0)).toBe(0);
  });
});

describe('isGroundLikeNormal', () => {
  it('accepts a strict +Y normal', () => {
    expect(isGroundLikeNormal(new THREE.Vector3(0, 1, 0))).toBe(true);
  });
  it('rejects a horizontal normal (wall)', () => {
    expect(isGroundLikeNormal(new THREE.Vector3(1, 0, 0))).toBe(false);
  });
  it('accepts a normal at the threshold', () => {
    expect(isGroundLikeNormal(new THREE.Vector3(0, MIN_GROUND_NORMAL_Y + 0.01, 0.8))).toBe(true);
  });
  it('rejects a normal just below the threshold', () => {
    expect(isGroundLikeNormal(new THREE.Vector3(0, MIN_GROUND_NORMAL_Y - 0.01, 0.99))).toBe(false);
  });

  it('does not normalize the input — raw .y above the threshold passes even if the vector is far from unit length', () => {
    // raw y = 0.65 (> 0.6), but magnitude ~10 so normalized y << 0.6.
    // If the function ever started normalizing, this would flip to false.
    expect(isGroundLikeNormal(new THREE.Vector3(0, 0.65, 10))).toBe(true);
  });
});

describe('computeSignApproachTarget', () => {
  it('lands SIGN_APPROACH_OFFSET_M short of the sign on the camera→sign line', () => {
    const cam = new THREE.Vector3(0, 0, 0);
    const sign = new THREE.Vector3(10, 0, 0);
    const stop = computeSignApproachTarget(cam, sign);
    expect(stop.x).toBeCloseTo(10 - SIGN_APPROACH_OFFSET_M, 5);
    expect(stop.z).toBe(0);
  });

  it('returns the camera position when the sign is closer than the offset (no advance)', () => {
    const cam = new THREE.Vector3(0, 0, 0);
    const sign = new THREE.Vector3(1, 0, 0); // closer than 2 m
    const stop = computeSignApproachTarget(cam, sign);
    expect(stop.x).toBeCloseTo(0, 5);
    expect(stop.z).toBe(0);
  });

  it('only considers xz distance (ignores y differences)', () => {
    const cam = new THREE.Vector3(0, 0, 0);
    const sign = new THREE.Vector3(10, 5, 0);
    const stop = computeSignApproachTarget(cam, sign);
    expect(stop.x).toBeCloseTo(10 - SIGN_APPROACH_OFFSET_M, 5);
    // y is preserved from the sign (caller decides what to do with it)
    expect(stop.y).toBe(5);
  });

  it('handles a diagonal approach (non-axis-aligned)', () => {
    const cam = new THREE.Vector3(0, 0, 0);
    const sign = new THREE.Vector3(6, 0, 8); // distXZ = 10
    const stop = computeSignApproachTarget(cam, sign);
    // stopFraction = (10 - 2) / 10 = 0.8
    expect(stop.x).toBeCloseTo(6 * 0.8, 5);
    expect(stop.z).toBeCloseTo(8 * 0.8, 5);
  });
});

describe('clampPitch', () => {
  it('passes through values inside [-PITCH_LIMIT_RAD, +PITCH_LIMIT_RAD]', () => {
    expect(clampPitch(0)).toBe(0);
    expect(clampPitch(PITCH_LIMIT_RAD - 0.01)).toBeCloseTo(PITCH_LIMIT_RAD - 0.01, 5);
  });
  it('clamps positive values above the limit', () => {
    expect(clampPitch(PITCH_LIMIT_RAD + 0.5)).toBeCloseTo(PITCH_LIMIT_RAD, 5);
  });
  it('clamps negative values below the limit', () => {
    expect(clampPitch(-PITCH_LIMIT_RAD - 0.5)).toBeCloseTo(-PITCH_LIMIT_RAD, 5);
  });
});
