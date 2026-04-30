import * as THREE from 'three';
import type { SplatMesh } from '@sparkjsdev/spark';

export interface PlaceModeOptions {
  canvas: HTMLCanvasElement;
  camera: THREE.Camera;
  splatMesh: SplatMesh;
  onHover: (point: THREE.Vector3 | null) => void;
  onClick: (point: THREE.Vector3) => void;
}

interface SplatIntersection {
  distance: number;
  point: THREE.Vector3;
  object: THREE.Object3D;
}

/**
 * Click-to-place against a Spark splat surface. Adds pointermove / click
 * listeners on the canvas; on each event, raycasts from the camera through
 * the cursor's NDC into the SplatMesh. The hit point (world space) is handed
 * back via the hover/click callbacks.
 *
 * Spark v2 exposes raycast intersections via `SplatMesh.raycast(raycaster, hits)`.
 * Splats with opacity < `minRaycastOpacity` (default 0.5) are ignored, which
 * keeps the surface "hard" and avoids hits inside the haze.
 */
export class PlaceModeController {
  private canvas: HTMLCanvasElement;
  private camera: THREE.Camera;
  private splatMesh: SplatMesh;
  private onHover: (p: THREE.Vector3 | null) => void;
  private onClick: (p: THREE.Vector3) => void;
  private raycaster = new THREE.Raycaster();
  private prevCursor: string;

  constructor(opts: PlaceModeOptions) {
    this.canvas = opts.canvas;
    this.camera = opts.camera;
    this.splatMesh = opts.splatMesh;
    this.onHover = opts.onHover;
    this.onClick = opts.onClick;
    this.prevCursor = this.canvas.style.cursor;
    this.canvas.style.cursor = 'crosshair';
    this.canvas.addEventListener('pointermove', this.handleMove);
    this.canvas.addEventListener('click', this.handleClick);
  }

  dispose() {
    this.canvas.removeEventListener('pointermove', this.handleMove);
    this.canvas.removeEventListener('click', this.handleClick);
    this.canvas.style.cursor = this.prevCursor;
    this.onHover(null);
  }

  private toNDC(e: PointerEvent | MouseEvent): THREE.Vector2 {
    const rect = this.canvas.getBoundingClientRect();
    return new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
  }

  private hit(ndc: THREE.Vector2): THREE.Vector3 | null {
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits: SplatIntersection[] = [];
    this.splatMesh.raycast(this.raycaster, hits);
    return hits[0]?.point ?? null;
  }

  private handleMove = (e: PointerEvent) => {
    this.onHover(this.hit(this.toNDC(e)));
  };

  private handleClick = (e: MouseEvent) => {
    const p = this.hit(this.toNDC(e));
    if (p) this.onClick(p);
  };
}
