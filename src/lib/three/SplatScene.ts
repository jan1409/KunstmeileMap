import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SplatMesh, SparkRenderer } from '@sparkjsdev/spark';

export interface SplatSceneOptions {
  canvas: HTMLCanvasElement;
  splatUrl: string;
  origin?: { x: number; y: number; z: number };
}

export interface SplatSceneHandle {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  splatMesh: SplatMesh;
  spark: SparkRenderer;
  controls: OrbitControls;
  dispose: () => void;
}

/**
 * Build a Three.js + Spark v2 Gaussian-Splat scene attached to the given canvas.
 *
 * Spark v2 requirements (learned the hard way — see Specs/06):
 *   1. WebGLRenderer must be `antialias: false` — WebGL MSAA actively hurts
 *      Gaussian-splat rendering and Spark's docs explicitly require this.
 *   2. A `SparkRenderer` instance must be added to the scene; it drives the
 *      per-frame splat sort + LoD pipeline. Without it, splats load but render
 *      as nothing (cube renders for one frame, then state corruption).
 *   3. The render loop MUST use `renderer.setAnimationLoop()`, not raw
 *      `requestAnimationFrame`. Spark hooks into Three's lifecycle.
 *   4. Most splats are captured with inverted Y; apply a 180° X quaternion flip
 *      (`splatMesh.quaternion.set(1, 0, 0, 0)`) to right them.
 */
export async function createSplatScene(opts: SplatSceneOptions): Promise<SplatSceneHandle> {
  const { canvas, splatUrl, origin = { x: 0, y: 0, z: 0 } } = opts;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth || 800, canvas.clientHeight || 600, false);
  renderer.setClearColor(0x101820, 1);

  const scene = new THREE.Scene();
  const aspect = (canvas.clientWidth || 800) / (canvas.clientHeight || 600);
  const camera = new THREE.PerspectiveCamera(60, aspect, 0.01, 1000);
  camera.position.set(0, 0, 8);
  camera.lookAt(0, 0, 0);

  const spark = new SparkRenderer({ renderer });
  scene.add(spark);

  // Camera controls — orbit/pan/zoom with touch gestures.
  // 1-finger drag: rotate. Pinch / scroll: zoom. 2-finger drag / right-click drag: pan.
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = true;
  controls.minDistance = 0.5;
  controls.maxDistance = 200;
  controls.maxPolarAngle = Math.PI / 2 + 0.2; // small underhang allowed; mostly above-horizon
  controls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN,
  };

  const splatMesh = new SplatMesh({ url: splatUrl });
  splatMesh.position.set(origin.x, origin.y, origin.z);
  splatMesh.quaternion.set(1, 0, 0, 0); // 180° X-flip; most splats are inverted-Y.
  scene.add(splatMesh);

  // Spark v2 exposes the load promise as `initialized`. Defensive probe `ready`
  // too in case a future version renames it.
  const m = splatMesh as unknown as Record<string, unknown>;
  const loadPromise = (m.initialized ?? m.ready) as Promise<unknown> | undefined;
  if (loadPromise && typeof loadPromise.then === 'function') {
    await loadPromise;
  }

  renderer.setAnimationLoop(() => {
    controls.update(); // required when enableDamping = true
    renderer.render(scene, camera);
  });

  const onResize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);

  const dispose = () => {
    renderer.setAnimationLoop(null);
    window.removeEventListener('resize', onResize);
    controls.dispose();
    spark.dispose();
    renderer.dispose();
    if ('dispose' in splatMesh && typeof (splatMesh as { dispose?: () => void }).dispose === 'function') {
      (splatMesh as { dispose: () => void }).dispose();
    }
  };

  return { scene, camera, renderer, splatMesh, spark, controls, dispose };
}
