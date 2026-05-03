import * as THREE from 'three';
import type { FrameHookRegistrar } from './cameraFlyby';
import type { SplatMesh } from '@sparkjsdev/spark';

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
 *
 * Expects a unit-length normal — Three.js raycast intersections always provide
 * one. The function does NOT normalize the input; callers passing a non-unit
 * vector will get incorrect results.
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

export class WalkCancelledError extends Error {
  constructor() {
    super('walk cancelled');
    this.name = 'WalkCancelledError';
  }
}

/**
 * Returns the ground y for a given world (x, z). Walk-mode callers raycast
 * downward against the splat surface; tests pass a pure function. Returning
 * `null` means "no hit" — keep the previous y.
 */
export type GroundSampler = (x: number, z: number) => number | null;

export interface WalkAnimateOptions {
  /** Final xz position; y is sampled at every resample tick. */
  target: THREE.Vector3;
  /** Total duration in ms. Caller should derive from computeWalkDuration. */
  durationMs: number;
  /** Optional easing on [0,1]. Default: cubic ease-in-out. */
  easing?: (t: number) => number;
}

export interface WalkAnimateHandle {
  promise: Promise<void>;
  cancel: () => void;
}

const cubicEaseInOut = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/**
 * Linearly lerp camera xz from current position to `target.xz` over
 * `durationMs`. Camera y = ground sample at current xz + EYE_HEIGHT_M,
 * resampled every GROUND_RESAMPLE_FRAMES frames. Between samples y is
 * held flat — a 5-frame stepped y at 60 fps (~83 ms/step) is sub-cm
 * jank at walking speed 3 m/s on typical Kunstmeile slopes; we accept
 * it for v1 and revisit if smoke shows visible jumps.
 *
 * Unlike flyTo, this does NOT touch controls.target or camera.quaternion —
 * the caller (WalkModeController) manages look direction independently.
 */
export function walkAnimateTo(
  camera: THREE.PerspectiveCamera,
  addFrameHook: FrameHookRegistrar,
  sampleGround: GroundSampler,
  opts: WalkAnimateOptions,
): WalkAnimateHandle {
  const easing = opts.easing ?? cubicEaseInOut;
  const startX = camera.position.x;
  const startZ = camera.position.z;
  const targetX = opts.target.x;
  const targetZ = opts.target.z;

  let elapsed = 0;
  let frameCount = 0;
  let lastSampledY = camera.position.y - EYE_HEIGHT_M;
  let resolved = false;
  let cancelled = false;
  let resolveFn!: () => void;
  let rejectFn!: (err: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolveFn = res;
    rejectFn = rej;
  });
  promise.catch(() => {}); // see flyTo: cancellation is normal control flow

  let removeHook: () => void = () => {};

  const tick = (deltaMs: number) => {
    if (resolved || cancelled) return;
    elapsed += deltaMs;
    frameCount += 1;
    const t = opts.durationMs <= 0 ? 1 : Math.min(1, elapsed / opts.durationMs);
    const e = easing(t);

    const x = startX + (targetX - startX) * e;
    const z = startZ + (targetZ - startZ) * e;

    if (frameCount % GROUND_RESAMPLE_FRAMES === 0 || t >= 1) {
      const y = sampleGround(x, z);
      if (y != null) lastSampledY = y;
    }

    camera.position.set(x, lastSampledY + EYE_HEIGHT_M, z);

    if (t >= 1) {
      resolved = true;
      removeHook();
      resolveFn();
    }
  };

  removeHook = addFrameHook(tick);

  const cancel = () => {
    if (resolved || cancelled) return;
    cancelled = true;
    removeHook();
    rejectFn(new WalkCancelledError());
  };

  return { promise, cancel };
}

export interface WalkModeControllerOptions {
  canvas: HTMLCanvasElement;
  camera: THREE.PerspectiveCamera;
  splatMesh: SplatMesh;
  addFrameHook: FrameHookRegistrar;
  /** Tents in world space; used to detect "tap on sign" vs "tap on ground". */
  signs: Array<{ id: string; position: THREE.Vector3 }>;
  /** Called when an auto-walk targeting a sign reaches its approach point. */
  onTentReached?: (tentId: string) => void;
}

type SplatHit = THREE.Intersection;

interface YawPitch {
  yaw: number;
  pitch: number;
}

const SIGN_HIT_RADIUS_M = 1.5; // a tap within this xz of a sign counts as a sign tap
const TAP_PIXEL_THRESHOLD = 6;
const TAP_TIME_THRESHOLD_MS = 500;
const DRAG_RAD_PER_PX = 0.005; // tuned to feel similar to OrbitControls drag-rotate

/**
 * Walk-mode pointer + camera owner. Consumes pointer events on the canvas,
 * drives auto-walks via walkAnimateTo, manages drag-to-rotate.
 *
 * Does NOT manage entry/exit transitions — the parent does those via
 * walkAnimateTo (entry) and the existing flyHome (exit).
 */
export class WalkModeController {
  private readonly canvas: HTMLCanvasElement;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly splatMesh: SplatMesh;
  private readonly addFrameHook: FrameHookRegistrar;
  private readonly signs: Array<{ id: string; position: THREE.Vector3 }>;
  private readonly onTentReached?: (tentId: string) => void;

  private readonly raycaster = new THREE.Raycaster();
  private readonly downwardRay = new THREE.Raycaster(
    new THREE.Vector3(),
    new THREE.Vector3(0, -1, 0),
    0,
    50,
  );

  private inFlightWalk: WalkAnimateHandle | null = null;
  private yawPitch: YawPitch;

  private dragStart: { clientX: number; clientY: number; yaw: number; pitch: number; t: number } | null = null;

  constructor(opts: WalkModeControllerOptions) {
    this.canvas = opts.canvas;
    this.camera = opts.camera;
    this.splatMesh = opts.splatMesh;
    this.addFrameHook = opts.addFrameHook;
    this.signs = opts.signs;
    this.onTentReached = opts.onTentReached;

    this.yawPitch = this.readYawPitchFromCamera();
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointercancel', this.handlePointerCancel);
    this.canvas.addEventListener('pointerleave', this.handlePointerCancel);
    this.canvas.style.cursor = 'pointer';
  }

  dispose(): void {
    this.inFlightWalk?.cancel();
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointercancel', this.handlePointerCancel);
    this.canvas.removeEventListener('pointerleave', this.handlePointerCancel);
    this.canvas.style.cursor = '';
  }

  /**
   * Public for tests + EventViewPage's "drop to ground" entry transition.
   * Returns the ground y at the camera's current xz, or null if no ground hit.
   */
  sampleGroundY(x: number, z: number): number | null {
    this.downwardRay.ray.origin.set(x, this.camera.position.y + 5, z);
    this.downwardRay.ray.direction.set(0, -1, 0);
    const hits: THREE.Intersection[] = [];
    this.splatMesh.raycast(this.downwardRay, hits);
    for (const h of hits) {
      if (!h.normal || isGroundLikeNormal(h.normal)) return h.point.y;
    }
    return null;
  }

  private readYawPitchFromCamera(): YawPitch {
    const e = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
    return { yaw: e.y, pitch: e.x };
  }

  private applyYawPitch(): void {
    const e = new THREE.Euler(this.yawPitch.pitch, this.yawPitch.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(e);
  }

  private toNDC(e: PointerEvent): THREE.Vector2 {
    const r = this.canvas.getBoundingClientRect();
    return new THREE.Vector2(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
  }

  private hitSplat(ndc: THREE.Vector2): SplatHit | null {
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits: THREE.Intersection[] = [];
    this.splatMesh.raycast(this.raycaster, hits);
    return hits[0] ?? null;
  }

  private findSignAt(point: THREE.Vector3): { id: string; position: THREE.Vector3 } | null {
    let nearest: { id: string; position: THREE.Vector3 } | null = null;
    let nearestDist = SIGN_HIT_RADIUS_M;
    for (const s of this.signs) {
      const dx = s.position.x - point.x;
      const dz = s.position.z - point.z;
      const d = Math.hypot(dx, dz);
      if (d < nearestDist) {
        nearest = s;
        nearestDist = d;
      }
    }
    return nearest;
  }

  private handlePointerDown = (e: PointerEvent) => {
    this.dragStart = {
      clientX: e.clientX,
      clientY: e.clientY,
      yaw: this.yawPitch.yaw,
      pitch: this.yawPitch.pitch,
      t: Date.now(),
    };
  };

  private handlePointerMove = (e: PointerEvent) => {
    const start = this.dragStart;
    if (!start) return;
    const dx = e.clientX - start.clientX;
    const dy = e.clientY - start.clientY;
    if (Math.hypot(dx, dy) < TAP_PIXEL_THRESHOLD) return;

    // Drag — cancel any in-flight walk on first drag movement.
    if (this.inFlightWalk) {
      this.inFlightWalk.cancel();
      this.inFlightWalk = null;
    }
    // Rotate.
    this.yawPitch.yaw = start.yaw - dx * DRAG_RAD_PER_PX;
    this.yawPitch.pitch = clampPitch(start.pitch - dy * DRAG_RAD_PER_PX);
    this.applyYawPitch();
  };

  private handlePointerCancel = () => {
    this.dragStart = null;
  };

  private handlePointerUp = (e: PointerEvent) => {
    const start = this.dragStart;
    this.dragStart = null;
    if (!start) return;
    const dt = Date.now() - start.t;
    const dist = Math.hypot(e.clientX - start.clientX, e.clientY - start.clientY);
    if (dist > TAP_PIXEL_THRESHOLD || dt > TAP_TIME_THRESHOLD_MS) return;

    // Tap — raycast against splat.
    const ndc = this.toNDC(e);
    const hit = this.hitSplat(ndc);
    if (!hit) return;
    if (hit.normal && !isGroundLikeNormal(hit.normal)) return;

    // Sign-or-ground? Find nearest sign within radius.
    const sign = this.findSignAt(hit.point);
    let target: THREE.Vector3;
    let arrivedSignId: string | null = null;
    if (sign) {
      target = computeSignApproachTarget(this.camera.position, sign.position);
      arrivedSignId = sign.id;
    } else {
      target = hit.point.clone();
    }

    // Cancel any in-flight walk before starting a new one.
    this.inFlightWalk?.cancel();

    const dx = target.x - this.camera.position.x;
    const dz = target.z - this.camera.position.z;
    const dist2D = Math.hypot(dx, dz);
    const handle = walkAnimateTo(
      this.camera,
      this.addFrameHook,
      (x, z) => this.sampleGroundY(x, z),
      { target, durationMs: computeWalkDuration(dist2D) },
    );
    this.inFlightWalk = handle;
    handle.promise
      .then(() => {
        if (this.inFlightWalk === handle) this.inFlightWalk = null;
        if (arrivedSignId) this.onTentReached?.(arrivedSignId);
      })
      .catch((err) => {
        if (!(err instanceof WalkCancelledError)) throw err;
        if (this.inFlightWalk === handle) this.inFlightWalk = null;
      });
  };
}
