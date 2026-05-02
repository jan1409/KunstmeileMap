import * as THREE from 'three';
import { SignPostMarker } from './SignPostMarker';

export interface MarkerData {
  id: string;
  position: { x: number; y: number; z: number };
  label?: string | null;
  selected?: boolean;
  dimmed?: boolean;
}

/**
 * A scene layer that renders markers at world coordinates. Each marker is a
 * `SignPostMarker` that automatically switches between a flat numbered sprite
 * (top-down view) and a 3D sign-post (tilted/ground-level view) based on the
 * polar angle from world-up to the camera. The switch uses hysteresis to
 * prevent flickering at the threshold.
 *
 * Per-frame logic (scale update, mode switch, disc billboard) runs via each
 * marker group's `onBeforeRender` hook — the same pattern as the previous
 * flat-sprite implementation.
 */
export class MarkerLayer {
  readonly group: THREE.Group;
  private markers = new Map<string, SignPostMarker>();

  constructor() {
    this.group = new THREE.Group();
    this.group.renderOrder = 999;
  }

  setMarkers(data: MarkerData[]): void {
    const seen = new Set<string>();
    for (const m of data) {
      seen.add(m.id);
      let marker = this.markers.get(m.id);
      if (!marker) {
        marker = new SignPostMarker(m.label ?? null);
        marker.group.userData.id = m.id;
        this.markers.set(m.id, marker);
        this.group.add(marker.group);
      } else {
        marker.setLabel(m.label ?? null);
      }
      marker.setPosition(m.position.x, m.position.y, m.position.z);
      marker.setSelected(m.selected === true);
      marker.setOpacity(m.dimmed ? 0.4 : 1.0);
    }
    for (const [id, marker] of this.markers) {
      if (!seen.has(id)) {
        this.group.remove(marker.group);
        marker.dispose();
        this.markers.delete(id);
      }
    }
  }

  hitTest(pointerNDC: THREE.Vector2, camera: THREE.Camera): string | null {
    if (this.markers.size === 0) return null;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointerNDC, camera);
    // Recursive: post + disc + sprite descendants of each SignPostMarker group.
    const hits = raycaster.intersectObjects(this.group.children, true);
    const first = hits[0];
    if (!first) return null;
    // Walk up the parent chain to find the SignPostMarker's group, which
    // carries the tent id in userData.
    let obj: THREE.Object3D | null = first.object;
    while (obj && !obj.userData.id) obj = obj.parent;
    return typeof obj?.userData.id === 'string' ? obj.userData.id : null;
  }

  dispose(): void {
    for (const marker of this.markers.values()) {
      this.group.remove(marker.group);
      marker.dispose();
    }
    this.markers.clear();
    this.group.clear();
  }
}
