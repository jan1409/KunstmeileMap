import { describe, it, expect } from 'vitest';
import { vi } from 'vitest';
import * as THREE from 'three';
import {
  computeLandingPose,
  LANDING_DISTANCE_M,
  MIN_LANDING_POLAR,
  MAX_LANDING_POLAR,
  flyTo,
  FlyCancelledError,
  type FrameHookRegistrar,
  type OrbitControlsLike,
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
      new THREE.Vector3(pose.position.x, pose.position.y, pose.position.z).sub(
        new THREE.Vector3(pose.target.x, pose.target.y, pose.target.z),
      ),
    );
    expect(after.phi).toBeCloseTo(MIN_LANDING_POLAR, 5);
  });

  it('clamps polar angle above MAX_LANDING_POLAR (camera near horizontal)', () => {
    // Camera level with target on +X axis → polar ≈ π/2.
    const cam = makeCamera([10, 0.001, 0]);
    const pose = computeLandingPose(cam, new THREE.Vector3(0, 0, 0), { x: 0, y: 0, z: 0 });
    const after = new THREE.Spherical().setFromVector3(
      new THREE.Vector3(pose.position.x, pose.position.y, pose.position.z).sub(
        new THREE.Vector3(pose.target.x, pose.target.y, pose.target.z),
      ),
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
      new THREE.Vector3(pose.position.x, pose.position.y, pose.position.z).sub(
        new THREE.Vector3(pose.target.x, pose.target.y, pose.target.z),
      ),
    );
    expect(after.phi).toBeCloseTo(polar, 5);
  });
});

interface FakeRegistrar {
  register: FrameHookRegistrar;
  fire: (deltaMs: number) => void;
  hookCount: () => number;
}

function makeRegistrar(): FakeRegistrar {
  const hooks = new Set<(deltaMs: number) => void>();
  return {
    register: (cb) => {
      hooks.add(cb);
      return () => {
        hooks.delete(cb);
      };
    },
    fire: (deltaMs) => {
      for (const cb of hooks) cb(deltaMs);
    },
    hookCount: () => hooks.size,
  };
}

function makeControls(): OrbitControlsLike {
  return {
    target: new THREE.Vector3(),
    enabled: true,
    enableDamping: true,
    update: vi.fn(),
  };
}

describe('flyTo', () => {
  it('reaches the end pose after running the animation to completion and re-enables controls', async () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 10);
    const controls = makeControls();
    controls.target.set(0, 0, 0);
    const reg = makeRegistrar();
    const endPose = {
      position: { x: 5, y: 5, z: 5 },
      target: { x: 1, y: 1, z: 1 },
    };

    const handle = flyTo(camera, controls, reg.register, endPose, { durationMs: 1000 });

    // 5 ticks of 200 ms each → animation runs to completion.
    for (let i = 0; i < 5; i++) reg.fire(200);

    await handle.promise;

    expect(camera.position.x).toBeCloseTo(5, 4);
    expect(camera.position.y).toBeCloseTo(5, 4);
    expect(camera.position.z).toBeCloseTo(5, 4);
    expect(controls.target.x).toBeCloseTo(1, 4);
    expect(controls.target.y).toBeCloseTo(1, 4);
    expect(controls.target.z).toBeCloseTo(1, 4);
    expect(controls.enabled).toBe(true);
    expect(controls.enableDamping).toBe(true);
    expect(reg.hookCount()).toBe(0); // disposer ran
  });

  it('cancels mid-flight, re-enables controls, and rejects the promise with FlyCancelledError', async () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 10);
    const controls = makeControls();
    const reg = makeRegistrar();

    const handle = flyTo(
      camera,
      controls,
      reg.register,
      { position: { x: 5, y: 5, z: 5 }, target: { x: 1, y: 1, z: 1 } },
      { durationMs: 1000 },
    );

    reg.fire(100); // 10 % through
    handle.cancel();

    await expect(handle.promise).rejects.toBeInstanceOf(FlyCancelledError);
    expect(controls.enabled).toBe(true);
    expect(controls.enableDamping).toBe(true);
    expect(reg.hookCount()).toBe(0);
  });

  it('disables controls and damping while the animation is running', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 10);
    const controls = makeControls();
    const reg = makeRegistrar();

    flyTo(
      camera,
      controls,
      reg.register,
      { position: { x: 1, y: 1, z: 1 }, target: { x: 0, y: 0, z: 0 } },
      { durationMs: 1000 },
    );

    expect(controls.enabled).toBe(false);
    expect(controls.enableDamping).toBe(false);
  });

  it('two concurrent flyTo calls are independent — neither auto-cancels the other', () => {
    // Two calls to flyTo create two independent handles. (Cancellation of an
    // in-flight flyby is the caller's responsibility.) This test documents
    // that behavior to prevent regressions if someone tries to make flyTo
    // globally exclusive.
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 10);
    const controls = makeControls();
    const reg = makeRegistrar();

    const a = flyTo(
      camera,
      controls,
      reg.register,
      { position: { x: 1, y: 1, z: 1 }, target: { x: 0, y: 0, z: 0 } },
      { durationMs: 1000 },
    );
    const b = flyTo(
      camera,
      controls,
      reg.register,
      { position: { x: 2, y: 2, z: 2 }, target: { x: 0, y: 0, z: 0 } },
      { durationMs: 1000 },
    );

    expect(reg.hookCount()).toBe(2);

    a.cancel();
    b.cancel();
  });
});
