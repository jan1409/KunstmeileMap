import * as THREE from 'three';
import {
  cameraDownTiltAngle,
  SIGNPOST_THRESHOLD,
  SIGNPOST_HYSTERESIS,
} from './cameraAngle';
import {
  createWoodPlankSideTexture,
  createWoodPlankTexture,
  createWoodPostTexture,
} from './woodTexture';

// Sign-post geometry — rustic wooden plank on a tapered post. Total
// height ~2.05 m. The plank face shows the number, four bolts, and a
// procedural wood pattern; the post is plain wood that wraps around
// the cylinder.
const POST_HEIGHT = 1.95;
const POST_RADIUS_BOTTOM = 0.04;
const POST_RADIUS_TOP = 0.025;
const PLANK_WIDTH = 0.7;
const PLANK_HEIGHT = 0.4;
const PLANK_DEPTH = 0.04;
// Plank centred just below the top of the post so the post visibly emerges
// from behind it (matches the aesthetic of a real signpost).
const PLANK_Y = 1.85;
const SCREEN_SCALE_FACTOR = 0.05; // matches MarkerLayer's existing factor

// Module-level singletons — the side and post wood textures don't vary
// per-marker (no number, no per-marker variation needed), so we lazy-init
// them once and share across every SignPostMarker instance. Saves
// ~50 MB of texture memory at 100 markers vs per-instance copies.
let SHARED_PLANK_SIDE_TEXTURE: THREE.CanvasTexture | null = null;
let SHARED_POST_TEXTURE: THREE.CanvasTexture | null = null;

function getSharedPlankSideTexture(): THREE.CanvasTexture {
  if (!SHARED_PLANK_SIDE_TEXTURE) {
    SHARED_PLANK_SIDE_TEXTURE = new THREE.CanvasTexture(createWoodPlankSideTexture());
    SHARED_PLANK_SIDE_TEXTURE.minFilter = THREE.LinearFilter;
  }
  return SHARED_PLANK_SIDE_TEXTURE;
}

function getSharedPostTexture(): THREE.CanvasTexture {
  if (!SHARED_POST_TEXTURE) {
    SHARED_POST_TEXTURE = new THREE.CanvasTexture(createWoodPostTexture());
    // Repeat horizontally so the texture wraps once around the cylinder
    // without seam stretching. Vertical clamping keeps the top/bottom
    // edges clean.
    SHARED_POST_TEXTURE.wrapS = THREE.RepeatWrapping;
    SHARED_POST_TEXTURE.wrapT = THREE.ClampToEdgeWrapping;
    SHARED_POST_TEXTURE.minFilter = THREE.LinearFilter;
  }
  return SHARED_POST_TEXTURE;
}

/**
 * Per-marker visual: a `Group` containing both
 *   - a flat numbered Sprite (visible when looking near top-down)
 *   - a 3D wooden sign-post (visible when tilted toward horizontal)
 *
 * `update(camera)` per frame reads the camera's GLOBAL tilt from
 * straight-down (NOT a per-marker angle — see cameraDownTiltAngle for
 * why) and toggles between modes with hysteresis around
 * SIGNPOST_THRESHOLD. The plank Y-axis-billboards toward the camera so
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
  private plankMesh: THREE.Mesh;
  // Per-marker resources (the plank face has the number, so each marker
  // owns its own texture; sprite likewise).
  private spriteTexture: THREE.CanvasTexture;
  private plankFaceTexture: THREE.CanvasTexture;
  private spriteMaterial: THREE.SpriteMaterial;
  private plankFaceMaterial: THREE.MeshBasicMaterial;
  private plankSideMaterial: THREE.MeshBasicMaterial;
  private postMaterial: THREE.MeshBasicMaterial;
  // Geometries — owned per-instance because their sizes are fixed but
  // disposing them with the marker is the cleanest lifecycle.
  private postGeometry: THREE.CylinderGeometry;
  private plankGeometry: THREE.BoxGeometry;
  // Per-frame state.
  private plankTarget = new THREE.Vector3();
  private plankWorldPos = new THREE.Vector3();
  private mode: 'flat' | 'signpost' = 'flat';
  private currentLabel: string | null = null;

  constructor(label: string | null) {
    this.group = new THREE.Group();
    this.currentLabel = label;

    // ---- Flat sprite (top-down view) ----
    this.spriteTexture = createSpriteTexture(label);
    this.spriteMaterial = new THREE.SpriteMaterial({
      map: this.spriteTexture,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });
    this.flatSprite = new THREE.Sprite(this.spriteMaterial);
    this.flatSprite.renderOrder = 999;
    this.group.add(this.flatSprite);

    // ---- 3D sign-post group (tilted-camera view) ----
    this.signPost = new THREE.Group();
    this.signPost.visible = false;

    // Tapered wooden post.
    this.postGeometry = new THREE.CylinderGeometry(
      POST_RADIUS_TOP,
      POST_RADIUS_BOTTOM,
      POST_HEIGHT,
      12,
    );
    this.postMaterial = new THREE.MeshBasicMaterial({
      map: getSharedPostTexture(),
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });
    const postMesh = new THREE.Mesh(this.postGeometry, this.postMaterial);
    postMesh.position.y = POST_HEIGHT / 2;
    postMesh.renderOrder = 999;
    this.signPost.add(postMesh);

    // Wooden plank with the number painted on it (front + back).
    this.plankFaceTexture = createPlankFaceTexture(label);
    this.plankFaceMaterial = new THREE.MeshBasicMaterial({
      map: this.plankFaceTexture,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });
    this.plankSideMaterial = new THREE.MeshBasicMaterial({
      map: getSharedPlankSideTexture(),
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });
    this.plankGeometry = new THREE.BoxGeometry(PLANK_WIDTH, PLANK_HEIGHT, PLANK_DEPTH);
    // BoxGeometry face order: [+x, -x, +y, -y, +z, -z]. We want the
    // front (+z) and back (-z) to show the wood-with-number; left/right/
    // top/bottom edges are slim plain-wood slivers.
    const plankMaterials = [
      this.plankSideMaterial, // +x
      this.plankSideMaterial, // -x
      this.plankSideMaterial, // +y
      this.plankSideMaterial, // -y
      this.plankFaceMaterial, // +z front
      this.plankFaceMaterial, // -z back
    ];
    this.plankMesh = new THREE.Mesh(this.plankGeometry, plankMaterials);
    this.plankMesh.position.y = PLANK_Y;
    this.plankMesh.renderOrder = 999;
    this.signPost.add(this.plankMesh);

    this.group.add(this.signPost);

    // Per-frame hook. Three.js does NOT call onBeforeRender on Groups (they
    // have no geometry); only objects that actually render get the hook.
    // Install on BOTH the flat sprite and the plank — exactly one is
    // visible at a time (the mode toggle in update() preserves this
    // invariant), so update() always runs every frame regardless of mode.
    const tick = (_renderer: THREE.WebGLRenderer, _scene: THREE.Scene, camera: THREE.Camera) => {
      this.update(camera);
    };
    this.flatSprite.onBeforeRender = tick;
    this.plankMesh.onBeforeRender = tick;
  }

  setPosition(x: number, y: number, z: number): void {
    this.group.position.set(x, y, z);
  }

  setLabel(label: string | null): void {
    if (label === this.currentLabel) return;
    this.currentLabel = label;
    redrawSpriteTexture(this.spriteTexture, label);
    redrawPlankFaceTexture(this.plankFaceTexture, label);
  }

  setSelected(selected: boolean): void {
    this.flatSprite.userData.selected = selected;
  }

  setOpacity(opacity: number): void {
    this.spriteMaterial.opacity = opacity;
    this.plankFaceMaterial.opacity = opacity;
    this.plankSideMaterial.opacity = opacity;
    this.postMaterial.opacity = opacity;
    // All four materials are always transparent (set in constructor); don't
    // toggle the flag here, otherwise alpha blending breaks at opacity=1.
  }

  /**
   * Per-frame update: camera-tilt mode switch + sprite distance scaling +
   * plank Y-axis billboard.
   */
  update(camera: THREE.Camera): void {
    // Mode switch with hysteresis. Angle is camera-global (same value
    // for every marker this frame), which keeps top-down views
    // consistent across markers regardless of xz position.
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

    if (this.mode === 'flat') {
      const distance = camera.position.distanceTo(this.group.position);
      const base = distance * SCREEN_SCALE_FACTOR;
      const boost = this.flatSprite.userData.selected === true ? 1.3 : 1.0;
      const s = Math.max(base * boost, 0.05);
      this.flatSprite.scale.set(s, s, 1);
    } else {
      // Y-axis-only billboard for the plank: rotate around Y so the
      // front face is most-perpendicular to the camera. Use the plank's
      // own world Y so the lookAt doesn't tilt the plank up or down.
      this.plankMesh.getWorldPosition(this.plankWorldPos);
      this.plankTarget.set(camera.position.x, this.plankWorldPos.y, camera.position.z);
      this.plankMesh.lookAt(this.plankTarget);
    }
  }

  dispose(): void {
    // Note: SHARED_PLANK_SIDE_TEXTURE and SHARED_POST_TEXTURE intentionally
    // not disposed here — they're module-level singletons reused across
    // markers and live for the page's lifetime.
    this.spriteMaterial.dispose();
    this.plankFaceMaterial.dispose();
    this.plankSideMaterial.dispose();
    this.postMaterial.dispose();
    this.postGeometry.dispose();
    this.plankGeometry.dispose();
    this.spriteTexture.dispose();
    this.plankFaceTexture.dispose();
  }
}

// ---------- Sprite (flat-mode) canvas helpers ----------

function createSpriteTexture(label: string | null): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  redrawSpriteCanvas(canvas, label);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

function redrawSpriteTexture(texture: THREE.CanvasTexture, label: string | null): void {
  redrawSpriteCanvas(texture.image as HTMLCanvasElement, label);
  texture.needsUpdate = true;
}

function redrawSpriteCanvas(canvas: HTMLCanvasElement, label: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Soft white halo for visual lift against complex splat backgrounds.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.beginPath();
  ctx.arc(64, 64, 62, 0, Math.PI * 2);
  ctx.fill();

  // Solid white inner disc — fully opaque (alpha 1.0) so splat colour
  // can't bleed through to make the number look faded.
  ctx.fillStyle = 'rgba(255, 255, 255, 1.0)';
  ctx.beginPath();
  ctx.arc(64, 64, 50, 0, Math.PI * 2);
  ctx.fill();

  // Hard dark outline — full opacity, slightly thicker — to delineate
  // the marker against bright splat regions.
  ctx.strokeStyle = 'rgba(10, 10, 10, 1.0)';
  ctx.lineWidth = 5;
  ctx.stroke();

  // The number itself.
  ctx.fillStyle = '#0a0a0a';
  ctx.font = 'bold 56px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label ?? '•', 64, 68);
}

// ---------- Plank-face (sign-post-mode) canvas helpers ----------

function createPlankFaceTexture(label: string | null): THREE.CanvasTexture {
  const canvas = createWoodPlankTexture(label);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

function redrawPlankFaceTexture(
  texture: THREE.CanvasTexture,
  label: string | null,
): void {
  // Re-render onto a fresh canvas of identical dimensions, then blit it
  // into the existing texture's image. Keeps the GPU resource handle
  // stable so the material doesn't need re-binding.
  const oldCanvas = texture.image as HTMLCanvasElement;
  const fresh = createWoodPlankTexture(label, {
    w: oldCanvas.width,
    h: oldCanvas.height,
  });
  const ctx = oldCanvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, oldCanvas.width, oldCanvas.height);
  ctx.drawImage(fresh, 0, 0);
  texture.needsUpdate = true;
}
