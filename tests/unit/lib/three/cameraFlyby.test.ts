import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  computeLandingPose,
  LANDING_DISTANCE_M,
  MIN_LANDING_POLAR,
  MAX_LANDING_POLAR,
} from '../../../../src/lib/three/cameraFlyby';

function makeCamera(position: [number, number, number]): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera();
  cam.position.set(...position);
  return cam;
}

describe('computeLandingPose', () => {
  it('returns the tent position as the new target', () => {
    const cam = makeCamera([0, 5, 10]);
    const pose = computeLandingPose(cam, new THREE.Vector3(0, 0, 0), { x: 3, y: 0, z: 4 });
    expect(pose.target).toEqual({ x: 3, y: 0, z: 4 });
  });

  it('lands at exactly LANDING_DISTANCE_M from the tent', () => {
    const cam = makeCamera([0, 5, 10]);
    const pose = computeLandingPose(cam, new THREE.Vector3(0, 0, 0), { x: 3, y: 0, z: 4 });
    const dx = pose.position.x - pose.target.x;
    const dy = pose.position.y - pose.target.y;
    const dz = pose.position.z - pose.target.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    expect(distance).toBeCloseTo(LANDING_DISTANCE_M, 5);
  });

  it('preserves the current azimuth angle', () => {
    // Camera at (10, 0, 0) relative to (0,0,0): azimuth = π/2 (looking down -X
    // toward origin from +X). After flyby to a new tent, azimuth should match.
    const cam = makeCamera([10, 0.001, 0.001]);
    const currentTarget = new THREE.Vector3(0, 0, 0);
    const tent = { x: 100, y: 0, z: 100 };

    const pose = computeLandingPose(cam, currentTarget, tent);

    const before = new THREE.Spherical().setFromVector3(
      new THREE.Vector3().subVectors(cam.position, currentTarget),
    );
    const after = new THREE.Spherical().setFromVector3(
      new THREE.Vector3().subVectors(
        new THREE.Vector3(pose.position.x, pose.position.y, pose.position.z),
        new THREE.Vector3(pose.target.x, pose.target.y, pose.target.z),
      ),
    );
    expect(after.theta).toBeCloseTo(before.theta, 5);
  });

  it('clamps polar angle below MIN_LANDING_POLAR (camera near top-down)', () => {
    // Camera straight above target → polar ≈ 0; below MIN_LANDING_POLAR.
    const cam = makeCamera([0, 10, 0]);
    const pose = computeLandingPose(cam, new THREE.Vector3(0, 0, 0), { x: 0, y: 0, z: 0 });
    const after = new THREE.Spherical().setFromVector3(
      new THREE.Vector3(pose.position.x, pose.position.y, pose.position.z),
    );
    expect(after.phi).toBeCloseTo(MIN_LANDING_POLAR, 5);
  });

  it('clamps polar angle above MAX_LANDING_POLAR (camera near horizontal)', () => {
    // Camera level with target on +X axis → polar ≈ π/2.
    const cam = makeCamera([10, 0.001, 0]);
    const pose = computeLandingPose(cam, new THREE.Vector3(0, 0, 0), { x: 0, y: 0, z: 0 });
    const after = new THREE.Spherical().setFromVector3(
      new THREE.Vector3(pose.position.x, pose.position.y, pose.position.z),
    );
    expect(after.phi).toBeCloseTo(MAX_LANDING_POLAR, 5);
  });

  it('preserves polar angle when already inside [MIN_LANDING_POLAR, MAX_LANDING_POLAR]', () => {
    // Build a camera at exactly polar = 60° (between 40 and 75) on +X side.
    const polar = THREE.MathUtils.degToRad(60);
    const radius = 10;
    const sph = new THREE.Spherical(radius, polar, 0);
    const offset = new THREE.Vector3().setFromSpherical(sph);
    const cam = new THREE.PerspectiveCamera();
    cam.position.copy(offset);

    const pose = computeLandingPose(cam, new THREE.Vector3(0, 0, 0), { x: 0, y: 0, z: 0 });
    const after = new THREE.Spherical().setFromVector3(
      new THREE.Vector3(pose.position.x, pose.position.y, pose.position.z),
    );
    expect(after.phi).toBeCloseTo(polar, 5);
  });
});
