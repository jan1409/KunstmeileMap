import * as THREE from 'three';

export interface MarkerData {
  id: string;
  position: { x: number; y: number; z: number };
  category_icon?: string | null;
  selected?: boolean;
  dimmed?: boolean;
}

/**
 * A scene layer that renders billboarded sprite markers at world coordinates.
 * Use setMarkers() to update the rendered set; old markers not in the new set
 * are removed and disposed. Use hitTest() to find which marker (if any) is
 * under a given screen-space NDC coordinate.
 */
export class MarkerLayer {
  readonly group: THREE.Group;
  private sprites = new Map<string, THREE.Sprite>();

  constructor() {
    this.group = new THREE.Group();
    // Markers always render on top of the splat — splats can be opaque/translucent
    // and markers should never be occluded.
    this.group.renderOrder = 999;
  }

  setMarkers(markers: MarkerData[]): void {
    const seen = new Set<string>();
    for (const m of markers) {
      seen.add(m.id);
      let sprite = this.sprites.get(m.id);
      const icon = m.category_icon ?? null;
      if (!sprite) {
        sprite = createMarkerSprite(icon);
        sprite.userData.id = m.id;
        this.sprites.set(m.id, sprite);
        this.group.add(sprite);
      } else if (sprite.userData.icon !== icon) {
        // Icon changed — rebuild the texture.
        const old = sprite.material;
        sprite.material = createMarkerMaterial(icon);
        old.map?.dispose();
        old.dispose();
      }
      sprite.userData.icon = icon;
      sprite.position.set(m.position.x, m.position.y, m.position.z);
      const scale = m.selected ? 1.3 : 1.0;
      sprite.scale.set(scale, scale, 1);
      sprite.material.opacity = m.dimmed ? 0.4 : 1.0;
      sprite.material.depthTest = false; // ensure markers always visible
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

  /** Hit-test screen-space NDC; returns the marker id under the pointer or null. */
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

function createMarkerSprite(icon: string | null): THREE.Sprite {
  const sprite = new THREE.Sprite(createMarkerMaterial(icon));
  // World-space size so markers stay roughly the same physical size in the
  // scene. Tweakable per use case.
  sprite.scale.set(1, 1, 1);
  return sprite;
}

function createMarkerMaterial(icon: string | null): THREE.SpriteMaterial {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Outer halo
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.fill();
    // Inner pin face
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.arc(64, 64, 50, 0, Math.PI * 2);
    ctx.fill();
    // Border
    ctx.strokeStyle = 'rgba(10, 10, 10, 0.8)';
    ctx.lineWidth = 4;
    ctx.stroke();
    // Icon
    ctx.fillStyle = '#0a0a0a';
    ctx.font = '64px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon ?? '•', 64, 68);
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
