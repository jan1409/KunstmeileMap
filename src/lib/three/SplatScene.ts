import * as THREE from 'three';
import { SplatMesh } from '@sparkjsdev/spark';

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
  dispose: () => void;
}

export async function createSplatScene(opts: SplatSceneOptions): Promise<SplatSceneHandle> {
  const { canvas, splatUrl, origin = { x: 0, y: 0, z: 0 } } = opts;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 500);
  camera.position.set(0, 5, 15);
  camera.lookAt(0, 0, 0);

  const splatMesh = new SplatMesh({ url: splatUrl });
  splatMesh.position.set(origin.x, origin.y, origin.z);
  scene.add(splatMesh);

  // Wait for Spark to download + decode the splat. Spark v2.x exposes the
  // load promise as `initialized` on SplatMesh (see node_modules types). We
  // also probe `ready` defensively for compatibility with possible API shifts.
  const meshAsRecord = splatMesh as unknown as Record<string, unknown>;
  const initialized = meshAsRecord.initialized;
  const ready = meshAsRecord.ready;
  if (initialized && typeof (initialized as Promise<unknown>).then === 'function') {
    await (initialized as Promise<unknown>);
  } else if (ready && typeof (ready as Promise<unknown>).then === 'function') {
    await (ready as Promise<unknown>);
  }

  let raf = 0;
  const tick = () => {
    raf = requestAnimationFrame(tick);
    renderer.render(scene, camera);
  };
  tick();

  const onResize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);

  const dispose = () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', onResize);
    renderer.dispose();
    if ('dispose' in splatMesh && typeof (splatMesh as { dispose?: () => void }).dispose === 'function') {
      (splatMesh as { dispose: () => void }).dispose();
    }
  };

  return { scene, camera, renderer, splatMesh, dispose };
}
