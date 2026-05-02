// Procedural rustic wood textures for sign-post markers. Draws into a
// canvas using vertical grain streaks, radial-gradient knots, edge
// weathering, and (for plank front/back) bolts + a painted number.
//
// Why procedural rather than a loaded image: keeps the deploy bundle small
// (no per-marker texture in /public), avoids stock-photo licensing, and
// renders fully at runtime so we can tweak color/grain without changing
// asset workflow. If the look ever needs to be photo-real, swap the
// `createWoodPlankTexture` / `createWoodPostTexture` callers in
// SignPostMarker.ts to TextureLoader.load('/textures/wood.jpg').

const BASE_R = 139;
const BASE_G = 110;
const BASE_B = 76;

interface WoodOptions {
  w?: number;
  h?: number;
  /** Deterministic seed so each marker's wood looks subtly different but stable across renders. */
  seed?: number;
}

// Tiny LCG so grain pattern is reproducible per-seed (otherwise re-renders
// would shimmer). Don't use for crypto.
function pseudoRandom(seed: number): () => number {
  let state = seed > 0 ? seed : 1;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

function drawWoodBase(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number): void {
  const rand = pseudoRandom(seed);

  // Base color.
  ctx.fillStyle = `rgb(${BASE_R}, ${BASE_G}, ${BASE_B})`;
  ctx.fillRect(0, 0, w, h);

  // Vertical grain — many subtle dark/light streaks running the full
  // height. ~200 streaks reads as wood without looking like a barcode.
  for (let i = 0; i < 200; i++) {
    const x = rand() * w;
    const lineWidth = 0.5 + rand() * 1.5;
    const dim = 0.55 + rand() * 0.5;
    const r = Math.floor(BASE_R * dim);
    const g = Math.floor(BASE_G * dim);
    const b = Math.floor(BASE_B * dim);
    const alpha = 0.2 + rand() * 0.4;
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    // Slight horizontal jitter so streaks aren't perfectly straight.
    ctx.lineTo(x + (rand() - 0.5) * 4, h);
    ctx.stroke();
  }

  // Knots — 2-4 darker radial spots that catch the eye.
  const knotCount = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < knotCount; i++) {
    const cx = rand() * w;
    const cy = rand() * h;
    const r = 4 + rand() * 12;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, 'rgba(50, 30, 18, 0.9)');
    grad.addColorStop(0.5, 'rgba(70, 45, 28, 0.5)');
    grad.addColorStop(1, 'rgba(80, 55, 35, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Edge weathering — darker tone at top + bottom, fading to clear in the
  // middle. Suggests age and gives the plank visual depth at the edges.
  const edgeGrad = ctx.createLinearGradient(0, 0, 0, h);
  edgeGrad.addColorStop(0, 'rgba(60, 40, 25, 0.4)');
  edgeGrad.addColorStop(0.15, 'rgba(0, 0, 0, 0)');
  edgeGrad.addColorStop(0.85, 'rgba(0, 0, 0, 0)');
  edgeGrad.addColorStop(1, 'rgba(60, 40, 25, 0.4)');
  ctx.fillStyle = edgeGrad;
  ctx.fillRect(0, 0, w, h);
}

function drawBolts(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const positions: Array<[number, number]> = [
    [w * 0.07, h * 0.18],
    [w * 0.93, h * 0.18],
    [w * 0.07, h * 0.82],
    [w * 0.93, h * 0.82],
  ];
  for (const [bx, by] of positions) {
    // Dark recessed hole.
    ctx.fillStyle = '#1a0e08';
    ctx.beginPath();
    ctx.arc(bx, by, 7, 0, Math.PI * 2);
    ctx.fill();

    // Rusty bolt face.
    ctx.fillStyle = '#5a3a20';
    ctx.beginPath();
    ctx.arc(bx, by, 5, 0, Math.PI * 2);
    ctx.fill();

    // Top-left highlight to suggest a 3D bolt head.
    ctx.fillStyle = 'rgba(200, 140, 80, 0.7)';
    ctx.beginPath();
    ctx.arc(bx - 2, by - 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawNumber(ctx: CanvasRenderingContext2D, w: number, h: number, label: string): void {
  ctx.font = `bold ${Math.floor(h * 0.55)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Subtle drop shadow for depth on textured background.
  ctx.fillStyle = 'rgba(20, 12, 6, 0.5)';
  ctx.fillText(label, w / 2 + 2, h / 2 + 2);

  // Dark stroke for contrast against light wood patches.
  ctx.strokeStyle = '#2a1a10';
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  ctx.strokeText(label, w / 2, h / 2);

  // Cream/painted fill — reads as faded white paint on weathered wood.
  ctx.fillStyle = '#f5ebd5';
  ctx.fillText(label, w / 2, h / 2);
}

/**
 * Plank front/back face: wood + 4 bolts + the painted number. 256×128
 * matches the plank's 0.7m×0.4m proportions and gives ~2px-per-mm
 * resolution which is plenty for sign-post viewing distances.
 */
export function createWoodPlankTexture(label: string | null, options: WoodOptions = {}): HTMLCanvasElement {
  const w = options.w ?? 256;
  const h = options.h ?? 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  drawWoodBase(ctx, w, h, options.seed ?? 1);
  drawBolts(ctx, w, h);
  if (label != null) drawNumber(ctx, w, h, label);

  return canvas;
}

/**
 * Plank side edges: plain wood (no bolts, no number). Slim because the
 * plank's depth is only 0.04m so the side faces are barely visible.
 */
export function createWoodPlankSideTexture(options: WoodOptions = {}): HTMLCanvasElement {
  const w = options.w ?? 64;
  const h = options.h ?? 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  drawWoodBase(ctx, w, h, options.seed ?? 3);
  return canvas;
}

/**
 * Post texture: plain wood that wraps around the cylinder. The cylinder's
 * default UV mapping has U going around the circumference and V going
 * top-to-bottom, so vertical grain in the texture appears as vertical
 * grain on the post (correct natural-wood orientation).
 */
export function createWoodPostTexture(options: WoodOptions = {}): HTMLCanvasElement {
  const w = options.w ?? 128;
  const h = options.h ?? 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  drawWoodBase(ctx, w, h, options.seed ?? 2);
  return canvas;
}
