// render/textures.js — small canvas-generated textures (soft blobs, glows, dappled light).
// Procedural, so there is nothing to load and nothing to license.
import { Texture } from 'pixi.js';
import { makeSimplex, fbm } from '../sim/noise.js';
import { mulberry32 } from '../sim/rng.js';

const cache = new Map();

/** Radial soft blob: white centre fading to transparent. Tint it with sprite.tint. */
export function softBlob(size = 128, hardness = 0.15) {
  const key = `blob${size}_${hardness}`;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(hardness, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, size, size);
  const t = Texture.from(c); cache.set(key, t); return t;
}

/** Sharper glow for fireflies/packets. */
export function glowDot(size = 64) {
  const key = `glow${size}`;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.2, 'rgba(255,255,255,0.8)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, size, size);
  const t = Texture.from(c); cache.set(key, t); return t;
}

/** Tileable dappled-light mask: soft bright blobs on transparent, additive use. */
export function dappleTexture(size = 512, seed = 11) {
  const key = `dapple${size}_${seed}`;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const rng = mulberry32(seed);
  // draw blobs 9 times (3×3 offsets) so the tile wraps seamlessly
  const blobs = Array.from({ length: 26 }, () => [rng() * size, rng() * size, 30 + rng() * 70, 0.5 + rng() * 0.5]);
  for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
    for (const [x, y, r, a] of blobs) {
      const grad = g.createRadialGradient(x + ox * size, y + oy * size, 0, x + ox * size, y + oy * size, r);
      grad.addColorStop(0, `rgba(255,236,190,${0.9 * a})`);
      grad.addColorStop(0.5, `rgba(255,236,190,${0.35 * a})`);
      grad.addColorStop(1, 'rgba(255,236,190,0)');
      g.fillStyle = grad; g.fillRect(x + ox * size - r, y + oy * size - r, r * 2, r * 2);
    }
  }
  const t = Texture.from(c); cache.set(key, t); return t;
}

/** Forest floor: simplex patches, leaf litter and faint game trails. Rendered once at 1 px/m. */
export function groundTexture(w, h, seed = 7) {
  const key = `ground${w}x${h}_${seed}`;
  if (cache.has(key)) return cache.get(key);
  const rng = mulberry32(seed * 7 + 1);
  const noise = makeSimplex(rng);
  const sc = 2;                               // noise raster at half resolution, upscaled (soft)
  const nw = Math.ceil(w / sc), nh = Math.ceil(h / sc);
  const nc = document.createElement('canvas'); nc.width = nw; nc.height = nh;
  const ng = nc.getContext('2d'); const img = ng.createImageData(nw, nh); const d = img.data;
  const base = [0x1C, 0x2F, 0x23], light = [0x2C, 0x4B, 0x35], mid = [0x22, 0x3A, 0x2B], dirt = [0x4A, 0x3E, 0x2E];
  for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
    const n = fbm(noise, x * 0.012, y * 0.012);                 // large patches
    const n2 = noise(x * 0.08 + 40, y * 0.08 + 9);               // litter speckle
    let v = (n + 1) / 2;                                        // 0..1
    let r, g, b;
    if (v < 0.5) { const u = v / 0.5; r = base[0] + (mid[0] - base[0]) * u; g = base[1] + (mid[1] - base[1]) * u; b = base[2] + (mid[2] - base[2]) * u; }
    else { const u = (v - 0.5) / 0.5; r = mid[0] + (light[0] - mid[0]) * u; g = mid[1] + (light[1] - mid[1]) * u; b = mid[2] + (light[2] - mid[2]) * u; }
    const sp = n2 * 6; r += sp; g += sp * 1.2; b += sp * 0.6;
    // dry/dirt patches where fbm is very low
    if (n < -0.45) { const u = Math.min(1, (-0.45 - n) / 0.25); r += (dirt[0] - r) * u * 0.6; g += (dirt[1] - g) * u * 0.6; b += (dirt[2] - b) * u * 0.6; }
    const i = (y * nw + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
  }
  ng.putImageData(img, 0, 0);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = true; g.drawImage(nc, 0, 0, w, h);
  // faint game trails (bezier paths) in dirt colour
  g.strokeStyle = 'rgba(91,74,54,0.22)'; g.lineCap = 'round'; g.lineJoin = 'round';
  for (let k = 0; k < 5; k++) {
    g.lineWidth = 7 + rng() * 6;
    g.beginPath();
    let x = rng() * w, y = rng() * h; g.moveTo(x, y);
    for (let s = 0; s < 6; s++) {
      const cx = x + (rng() - 0.5) * 300, cy = y + (rng() - 0.5) * 300;
      x = Math.max(0, Math.min(w, x + (rng() - 0.5) * 420)); y = Math.max(0, Math.min(h, y + (rng() - 0.5) * 320));
      g.quadraticCurveTo(cx, cy, x, y);
    }
    g.stroke();
  }
  // leaf-litter freckles
  for (let k = 0; k < 900; k++) {
    const x = rng() * w, y = rng() * h, rr = 1 + rng() * 2.2;
    g.fillStyle = rng() < 0.5 ? 'rgba(60,92,60,0.35)' : 'rgba(20,34,24,0.45)';
    g.beginPath(); g.ellipse(x, y, rr * 1.6, rr, rng() * 3, 0, Math.PI * 2); g.fill();
  }
  const t = Texture.from(c); cache.set(key, t); return t;
}
