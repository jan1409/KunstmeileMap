import * as THREE from 'three';

export interface MarkerData {
  id: string;
  position: { x: number; y: number; z: number };
  label?: string | null;
  selected?: boolean;
  dimmed?: boolean;
}

// Empirical: at FOV 60°, this factor times camera-distance gives roughly
// 64 px tall markers at 1080p. Tweakable later if marker visual prominence
// needs to change.
const SCREEN_SCALE_FACTOR = 0.05;

/**
 * A scene layer that renders billboarded sprite markers at world coordinates.
 * Markers maintain a roughly constant on-screen pixel size regardless of
 * camera distance (per-frame scale update via onBeforeRender).
 */
export class MarkerLayer {
  readonly group: THREE.Group;
  private sprites = new Map<string, THREE.Sprite>();

  constructor() {
    this.group = new THREE.Group();
    this.group.renderOrder = 999;
  }

  setMarkers(markers: MarkerData[]): void {
    const seen = new Set<string>();
    for (const m of markers) {
      seen.add(m.id);
      let sprite = this.sprites.get(m.id);
      const label = m.label ?? null;
      if (!sprite) {
        sprite = createMarkerSprite(label);
        sprite.userData.id = m.id;
        this.sprites.set(m.id, sprite);
        this.group.add(sprite);
      } else if (sprite.userData.label !== label) {
        const old = sprite.material;
        sprite.material = createMarkerMaterial(label);
        old.map?.dispose();
        old.dispose();
      }
      sprite.userData.label = label;
      sprite.userData.selected = m.selected === true;
      sprite.position.set(m.position.x, m.position.y, m.position.z);
      sprite.material.opacity = m.dimmed ? 0.4 : 1.0;
      sprite.material.depthTest = false;
      sprite.material.transparent = true;
    }
    for (const [id, sprite] of this.sprites) {
      if (!seen.has(id)) {
        this.group.remove(sprite);
        sprite.material.map?.dispose();
        sprite.material.dispose();
        this.sprites.delete(id);
      }
    }
  }

  hitTest(pointerNDC: THREE.Vector2, camera: THREE.Camera): string | null {
    if (this.sprites.size === 0) return null;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointerNDC, camera);
    const hits = raycaster.intersectObjects(this.group.children, false);
    const first = hits[0];
    if (!first) return null;
    const id = first.object.userData.id;
    return typeof id === 'string' ? id : null;
  }

  dispose(): void {
    for (const sprite of this.sprites.values()) {
      sprite.material.map?.dispose();
      sprite.material.dispose();
    }
    this.sprites.clear();
    this.group.clear();
  }
}

function createMarkerSprite(label: string | null): THREE.Sprite {
  const sprite = new THREE.Sprite(createMarkerMaterial(label));
  // Per-frame: rescale based on camera distance so markers look roughly
  // constant size on screen. Selected markers get a 30% size boost.
  sprite.onBeforeRender = (_renderer, _scene, camera) => {
    const distance = camera.position.distanceTo(sprite.position);
    const base = distance * SCREEN_SCALE_FACTOR;
    const boost = sprite.userData.selected === true ? 1.3 : 1.0;
    const s = Math.max(base * boost, 0.05);
    sprite.scale.set(s, s, 1);
  };
  return sprite;
}

function createMarkerMaterial(label: string | null): THREE.SpriteMaterial {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
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
    // Slightly tighter font + bold so 3-digit numbers fit.
    ctx.font = 'bold 56px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label ?? '•', 64, 68);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return new THREE.SpriteMaterial({
    map: texture,
    depthTest: false,
    transparent: true,
  });
}
