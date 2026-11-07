// charts/heatmap.js — distance × accuracy map of Layer A steady-state pair intake, computed in a
// worker, drawn with viridis, with a crosshair bound to the sliders and click-to-run.
import { sweep, viridis } from './sweep.js';

const LAYERS = [['G', 'Pair intake G*', 'food/min'], ['gain', 'Gain vs far-apart silent pair', 'Δ food/min'], ['misled', 'Fraction of time misled', '']];

export function createHeatmap(canvas, capEl, layerEl, { onPick, nd = 25, na = 25 } = {}) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height, pad = { l: 56, r: 78, t: 14, b: 44 };
  const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
  const dGrid = Array.from({ length: nd }, (_, i) => 20 + (800 - 20) * i / (nd - 1));
  const aGrid = Array.from({ length: na }, (_, j) => j / (na - 1));
  let data = null, layer = 'G', cross = { d: 200, a: 0.9 }, hover = null, busy = false, queued = null;
  const off = document.createElement('canvas'); off.width = nd; off.height = na; const octx = off.getContext('2d');

  for (const [id, name] of LAYERS) { const b = document.createElement('button'); b.textContent = name; b.dataset.id = id; b.classList.toggle('active', id === layer); b.onclick = () => { layer = id; layerEl.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b)); draw(); }; layerEl.appendChild(b); }

  const xOf = d => pad.l + (d - 20) / 780 * pw, yOf = a => pad.t + (1 - a) * ph;
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0F1A14'; ctx.fillRect(0, 0, W, H);
    if (!data) { ctx.fillStyle = '#9BB3A4'; ctx.font = '13px Inter, sans-serif'; ctx.fillText('computing 625 steady states…', pad.l + 20, H / 2); return; }
    const z = data[layer]; let lo = Infinity, hi = -Infinity; for (const v of z) { if (v < lo) lo = v; if (v > hi) hi = v; }
    if (layer === 'gain') { const m = Math.max(Math.abs(lo), Math.abs(hi)); lo = -m; hi = m; }
    const img = octx.createImageData(nd, na);
    for (let j = 0; j < na; j++) for (let i = 0; i < nd; i++) {
      const v = z[j * nd + i], t = (v - lo) / (hi - lo || 1), [r, g, b] = viridis(t);
      const k = ((na - 1 - j) * nd + i) * 4; img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = 255;
    }
    octx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, pad.l, pad.t, pw, ph);
    // ridge: best d for each accuracy row
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.beginPath();
    for (let j = 0; j < na; j++) { let bi = 0; for (let i = 1; i < nd; i++) if (data.G[j * nd + i] > data.G[j * nd + bi]) bi = i; const x = xOf(dGrid[bi]), y = yOf(aGrid[j]); j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke(); ctx.setLineDash([]);
    // axes
    ctx.fillStyle = '#9BB3A4'; ctx.font = '11px JetBrains Mono, monospace'; ctx.textAlign = 'center';
    for (const d of [100, 200, 300, 400, 500, 600, 700, 800]) { ctx.fillText(d, xOf(d), H - pad.b + 16); }
    ctx.fillStyle = '#E8F3EC'; ctx.font = '12px Inter, sans-serif'; ctx.fillText('separation d (m)', pad.l + pw / 2, H - 8);
    ctx.textAlign = 'right'; ctx.fillStyle = '#9BB3A4'; ctx.font = '11px JetBrains Mono, monospace';
    for (const a of [0, 0.25, 0.5, 0.75, 1]) ctx.fillText(a.toFixed(2), pad.l - 6, yOf(a) + 4);
    ctx.save(); ctx.translate(14, pad.t + ph / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillStyle = '#E8F3EC'; ctx.font = '12px Inter, sans-serif'; ctx.fillText('accuracy a = ε·h', 0, 0); ctx.restore();
    // d_c marker
    const dc = data.params.dc; if (dc <= 800) { ctx.strokeStyle = 'rgba(94,234,212,0.7)'; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(xOf(dc), pad.t); ctx.lineTo(xOf(dc), pad.t + ph); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#5EEAD4'; ctx.textAlign = 'left'; ctx.font = '11px JetBrains Mono, monospace'; ctx.fillText('d_c', xOf(dc) + 4, pad.t + 12); }
    // colour bar
    const bx = W - pad.r + 16, bw = 14;
    for (let k = 0; k < ph; k++) { const [r, g, b] = viridis(1 - k / ph); ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.fillRect(bx, pad.t + k, bw, 1.5); }
    ctx.fillStyle = '#9BB3A4'; ctx.textAlign = 'left'; ctx.font = '10.5px JetBrains Mono, monospace';
    ctx.fillText(hi.toFixed(2), bx + bw + 4, pad.t + 9); ctx.fillText(lo.toFixed(2), bx + bw + 4, pad.t + ph); ctx.fillText(((lo + hi) / 2).toFixed(2), bx + bw + 4, pad.t + ph / 2 + 4);
    // crosshair
    const cx = xOf(cross.d), cy = yOf(Math.min(1, cross.a));
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(pad.l, cy); ctx.lineTo(pad.l + pw, cy); ctx.moveTo(cx, pad.t); ctx.lineTo(cx, pad.t + ph); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    if (hover) { const v = sample(hover.d, hover.a); ctx.fillStyle = 'rgba(8,20,14,0.85)'; const tx = Math.min(W - 150, xOf(hover.d) + 10), ty = Math.max(pad.t + 10, yOf(hover.a) - 28); ctx.fillRect(tx, ty, 138, 22); ctx.fillStyle = '#E8F3EC'; ctx.textAlign = 'left'; ctx.font = '11px JetBrains Mono, monospace'; ctx.fillText(`d=${hover.d.toFixed(0)} a=${hover.a.toFixed(2)} → ${v.toFixed(3)}`, tx + 6, ty + 15); }
    const [, name, unit] = LAYERS.find(l => l[0] === layer);
    capEl.innerHTML = `Colour: <b>${name}</b> ${unit ? '(' + unit + ')' : ''}. x: separation d (m); y: accuracy a = ε·h applied to both animals; other parameters as in the sandbox. Dotted white: ridge of best d for each accuracy. At the crosshair: G* = ${sample(cross.d, cross.a, 'G').toFixed(3)} food/min, ${(100 * sample(cross.d, cross.a, 'gain') / (sample(cross.d, cross.a, 'G') - sample(cross.d, cross.a, 'gain'))).toFixed(1)} % vs two silent foragers far apart (0.667).`;
  }
  function sample(d, a, lay = layer) {
    if (!data) return 0; const z = data[lay];
    const fi = Math.min(nd - 1, Math.max(0, (d - 20) / 780 * (nd - 1))), fj = Math.min(na - 1, Math.max(0, a * (na - 1)));
    const i0 = Math.floor(fi), j0 = Math.floor(fj), i1 = Math.min(nd - 1, i0 + 1), j1 = Math.min(na - 1, j0 + 1), u = fi - i0, v = fj - j0;
    return (z[j0 * nd + i0] * (1 - u) + z[j0 * nd + i1] * u) * (1 - v) + (z[j1 * nd + i0] * (1 - u) + z[j1 * nd + i1] * u) * v;
  }
  function toData(ev) { const r = canvas.getBoundingClientRect(); const x = (ev.clientX - r.left) * W / r.width, y = (ev.clientY - r.top) * H / r.height; const d = 20 + (x - pad.l) / pw * 780, a = 1 - (y - pad.t) / ph; if (d < 20 || d > 800 || a < 0 || a > 1) return null; return { d, a }; }
  canvas.addEventListener('pointermove', ev => { hover = toData(ev); draw(); });
  canvas.addEventListener('pointerleave', () => { hover = null; draw(); });
  canvas.addEventListener('click', ev => { const p = toData(ev); if (!p) return; cross = { d: Math.round(p.d / 5) * 5, a: Math.round(p.a * 20) / 20 }; draw(); onPick && onPick(cross.d, cross.a); });
  draw();
  return {
    async update(params) {
      if (busy) { queued = params; return; }
      busy = true;
      try { const res = await sweep({ type: 'grid', params: { ...params }, dGrid, aGrid }); data = { ...res, params: { ...params } }; draw(); }
      catch (e) { console.warn('heatmap', e); capEl.textContent = 'Map unavailable: ' + e.message; }
      busy = false; if (queued) { const q = queued; queued = null; this.update(q); }
    },
    setCrosshair(d, a) { cross = { d, a }; draw(); },
  };
}
