// sim/noise.js — 2-D simplex noise (Gustavson) and Bridson Poisson-disk sampling. Pure, seeded.
const TAU = Math.PI * 2;

export function makeSimplex(rand) {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const G = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  return function noise(x, y) {
    const s = (x + y) * F2, i = Math.floor(x + s), j = Math.floor(y + s), t = (i + j) * G2;
    const x0 = x - (i - t), y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0;
    let tt = 0.5 - x0 * x0 - y0 * y0; if (tt > 0) { tt *= tt; const g = G[perm[ii + perm[jj]] & 7]; n += tt * tt * (g[0] * x0 + g[1] * y0); }
    tt = 0.5 - x1 * x1 - y1 * y1; if (tt > 0) { tt *= tt; const g = G[perm[ii + i1 + perm[jj + j1]] & 7]; n += tt * tt * (g[0] * x1 + g[1] * y1); }
    tt = 0.5 - x2 * x2 - y2 * y2; if (tt > 0) { tt *= tt; const g = G[perm[ii + 1 + perm[jj + 1]] & 7]; n += tt * tt * (g[0] * x2 + g[1] * y2); }
    return 70 * n;   // ≈ [-1, 1]
  };
}

/** Fractal (3-octave) noise in [-1, 1]. */
export function fbm(noise, x, y) {
  return 0.6 * noise(x, y) + 0.3 * noise(x * 2.7 + 11, y * 2.7 + 7) + 0.1 * noise(x * 7.1 + 3, y * 7.1 + 5);
}

/** Bridson Poisson-disk samples in [0,w]×[0,h] with min distance r. */
export function poissonDisk(w, h, r, rand, k = 30) {
  const cell = r / Math.SQRT2, gw = Math.ceil(w / cell), gh = Math.ceil(h / cell);
  const grid = new Int32Array(gw * gh).fill(-1), pts = [], active = [];
  const add = (x, y) => { pts.push([x, y]); active.push(pts.length - 1); grid[Math.floor(y / cell) * gw + Math.floor(x / cell)] = pts.length - 1; };
  add(rand() * w, rand() * h);
  while (active.length) {
    const ai = Math.floor(rand() * active.length), [px, py] = pts[active[ai]];
    let found = false;
    for (let n = 0; n < k; n++) {
      const a = rand() * TAU, dd = r * (1 + rand()), x = px + Math.cos(a) * dd, y = py + Math.sin(a) * dd;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
      let ok = true;
      for (let yy = Math.max(0, gy - 2); yy <= Math.min(gh - 1, gy + 2) && ok; yy++)
        for (let xx = Math.max(0, gx - 2); xx <= Math.min(gw - 1, gx + 2); xx++) {
          const q = grid[yy * gw + xx];
          if (q >= 0 && Math.hypot(pts[q][0] - x, pts[q][1] - y) < r) { ok = false; break; }
        }
      if (ok) { add(x, y); found = true; break; }
    }
    if (!found) active.splice(ai, 1);
  }
  return pts;
}
