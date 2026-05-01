import * as THREE from 'three';
import {
  cameraDownTiltAngle,
  SIGNPOST_THRESHOLD,
  SIGNPOST_HYSTERESIS,
} from './cameraAngle';

// Sign-post geometry — bumped 1.5× from the v1 spec after on-splat smoke
// testing showed the discs were too small to read from horizontal-view
// distances. Total height ~2.3 m. Post radius stays slim; fattening it
// looked cartoonish.
const POST_HEIGHT = 1.95;
const POST_RADIUS = 0.025;
const DISC_RADIUS = 0.225;
const DISC_Y = 2.1;
const SCREEN_SCALE_FACTOR = 0.05; // matches MarkerLayer's existing factor

/**
 * Per-marker visual: a `Group` containing both
 *   - a flat numbered Sprite (visible when looking near top-down)
 *   - a 3D sign-post (visible when tilted toward horizontal)
 *
 * `update(camera)` per frame reads the camera's GLOBAL tilt from
 * straight-down (NOT a per-marker angle — see cameraDownTiltAngle for
 * why) and toggles between modes with hysteresis around
 * SIGNPOST_THRESHOLD. The disc Y-axis-billboards toward the camera so
 * the number is always readable from the side.
 *
 * Sprite scale is recomputed each frame so the on-screen size stays
 * roughly constant regardless of camera distance — same idiom as the
 * pre-existing MarkerLayer sprites.
 */
export class SignPostMarker {
  readonly group: THREE.Group;
  private flatSprite: THREE.Sprite;
  private signPost: THREE.Group;
  private discMesh: THREE.Mesh;
  private texture: THREE.CanvasTexture;
  private spriteMaterial: THREE.SpriteMaterial;
  private discMaterial: THREE.MeshBasicMaterial;
  private postMaterial: THREE.MeshBasicMaterial;
  private postGeometry: THREE.CylinderGeometry;
  private discGeometry: THREE.CircleGeometry;
  private discTarget = new THREE.Vector3();
  private discWorldPos = new THREE.Vector3();
  private mode: 'flat' | 'signpost' = 'flat';
  private currentLabel: string | null = null;

  constructor(label: string | null) {
    this.group = new THREE.Group();
    this.currentLabel = label;
    this.texture = createNumberTexture(label);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.needsUpdate = true;

    // Flat sprite (existing marker style).
    this.spriteMaterial = new THREE.SpriteMaterial({
      map: this.texture,
      depthTest: false,
      transparent: true,
    });
    this.flatSprite = new THREE.Sprite(this.spriteMaterial);
    this.group.add(this.flatSprite);

    // 3D sign-post group.
    this.signPost = new THREE.Group();
    this.signPost.visible = false;

    this.postGeometry = new THREE.CylinderGeometry(
      POST_RADIUS,
      POST_RADIUS,
      POST_HEIGHT,
      8,
    );
    // depthTest: false + transparent: true matches the flat sprite's posture
    // so the post stacks consistently above splat geometry. With Spark v2's
    // depth output being permissive, default depthTest=true would let splat
    // pixels occlude the post unpredictably.
    this.postMaterial = new THREE.MeshBasicMaterial({
      color: 0xf5f5f5,
      depthTest: false,
      transparent: true,
    });
    const postMesh = new THREE.Mesh(this.postGeometry, this.postMaterial);
    postMesh.position.y = POST_HEIGHT / 2;
    postMesh.renderOrder = 999;
    this.signPost.add(postMesh);

    this.discGeometry = new THREE.CircleGeometry(DISC_RADIUS, 32);
    // Reuse the same canvas texture — disc reads as the same numbered sign.
    this.discMaterial = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthTest: false,
      side: THREE.DoubleSide,
    });
    this.discMesh = new THREE.Mesh(this.discGeometry, this.discMaterial);
    this.discMesh.position.y = DISC_Y;
    this.discMesh.renderOrder = 999;
    this.signPost.add(this.discMesh);

    this.group.add(this.signPost);

    // Per-frame hook. Three.js does NOT call onBeforeRender on Groups (they
    // have no geometry); only objects that actually render get the hook.
    // Install on BOTH the flat sprite and the disc — exactly one is visible
    // at a time (the mode toggle in update() preserves this invariant), so
    // update() always runs every frame regardless of mode.
    const tick = (_renderer: THREE.WebGLRenderer, _scene: THREE.Scene, camera: THREE.Camera) => {
      this.update(camera);
    };
    this.flatSprite.onBeforeRender = tick;
    this.discMesh.onBeforeRender = tick;
  }

  setPosition(x: number, y: number, z: number): void {
    this.group.position.set(x, y, z);
  }

  setLabel(label: string | null): void {
    if (label === this.currentLabel) return;
    this.currentLabel = label;
    // Re-render the canvas texture in place — keeps the same texture
    // object so both flat sprite and disc pick up the new number.
    redrawNumberTexture(this.texture, label);
  }

  setSelected(selected: boolean): void {
    this.flatSprite.userData.selected = selected;
  }

  setOpacity(opacity: number): void {
    this.spriteMaterial.opacity = opacity;
    this.discMaterial.opacity = opacity;
    this.postMaterial.opacity = opacity;
    // All three materials are always transparent (set in constructor); don't
    // toggle the flag here, otherwise alpha blending breaks at opacity=1.
  }

  /**
   * Per-frame update: camera-tilt mode switch + sprite distance scaling +
   * disc Y-axis billboard.
   */
  update(camera: THREE.Camera): void {
    // 1. Mode switch with hysteresis. Angle is camera-global (same value
    // for every marker in the scene this frame), which keeps top-down
    // views consistent across markers regardless of their xz position.
    const angle = cameraDownTiltAngle(camera);
    if (this.mode === 'flat' && angle > SIGNPOST_THRESHOLD + SIGNPOST_HYSTERESIS) {
      this.mode = 'signpost';
      this.flatSprite.visible = false;
      this.signPost.visible = true;
    } else if (
      this.mode === 'signpost' &&
      angle < SIGNPOST_THRESHOLD - SIGNPOST_HYSTERESIS
    ) {
      this.mode = 'flat';
      this.flatSprite.visible = true;
      this.signPost.visible = false;
    }

    // 2. Sprite distance scaling (only relevant when flat is visible).
    if (this.mode === 'flat') {
      const distance = camera.position.distanceTo(this.group.position);
      const base = distance * SCREEN_SCALE_FACTOR;
      const boost = this.flatSprite.userData.selected === true ? 1.3 : 1.0;
      const s = Math.max(base * boost, 0.05);
      this.flatSprite.scale.set(s, s, 1);
    } else {
      // 3. Disc Y-axis billboard toward camera (sign-post mode only).
      // Use the disc's own world Y so the disc stays vertical (no up/down tilt).
      this.discMesh.getWorldPosition(this.discWorldPos);
      this.discTarget.set(camera.position.x, this.discWorldPos.y, camera.position.z);
      this.discMesh.lookAt(this.discTarget);
    }
  }

  dispose(): void {
    this.spriteMaterial.dispose();
    this.discMaterial.dispose();
    this.postMaterial.dispose();
    this.postGeometry.dispose();
    this.discGeometry.dispose();
    this.texture.dispose();
  }
}

// ---------- canvas-texture helpers (extracted from MarkerLayer's inline code)

function createNumberTexture(label: string | null): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  redrawCanvas(canvas, label);
  return new THREE.CanvasTexture(canvas);
}

function redrawNumberTexture(texture: THREE.CanvasTexture, label: string | null): void {
  redrawCanvas(texture.image as HTMLCanvasElement, label);
  texture.needsUpdate = true;
}

function redrawCanvas(canvas: HTMLCanvasElement, label: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.beginPath();
  ctx.arc(64, 64, 60, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.beginPath();
  ctx.arc(64, 64, 50, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(10, 10, 10, 0.8)';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = '#0a0a0a';
  ctx.font = 'bold 56px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label ?? '•', 64, 68);
}
