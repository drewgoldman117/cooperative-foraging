// charts/phase.js — Layer B phase line (dd/dt vs d) and Layer C (h, β) phase portrait, both from
// steady states computed in the sweep worker.
import { sweep } from './sweep.js';

function frame(ctx, W, H, pad) { ctx.fillStyle = '#0F1A14'; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = '#2A3D32'; ctx.lineWidth = 1; ctx.strokeRect(pad.l + 0.5, pad.t + 0.5, W - pad.l - pad.r, H - pad.t - pad.b); }
function arrowHead(ctx, x, y, ang, s = 5) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(ang - 0.5) * s, y - Math.sin(ang - 0.5) * s); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(ang + 0.5) * s, y - Math.sin(ang + 0.5) * s); ctx.stroke(); }

export function createPhaseLine(canvas, capEl) {
  const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height, pad = { l: 50, r: 16, t: 14, b: 40 };
  let busy = false, queued = null;
  function draw(r, params) {
    frame(ctx, W, H, pad);
    const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
    const fmax = Math.max(1e-6, ...r.f.map(Math.abs));
    const x = d => pad.l + (d - r.d[0]) / (r.d[r.d.length - 1] - r.d[0]) * pw, y = f => pad.t + ph / 2 - f / fmax * ph * 0.45;
    ctx.strokeStyle = '#2A3D32'; ctx.beginPath(); ctx.moveTo(pad.l, y(0)); ctx.lineTo(pad.l + pw, y(0)); ctx.stroke();
    // G*(d) faint, scaled
    const gmin = Math.min(...r.G), gmax = Math.max(...r.G);
    ctx.strokeStyle = 'rgba(255,210,63,0.5)'; ctx.lineWidth = 1.2; ctx.beginPath();
    r.d.forEach((d, i) => { const yy = pad.t + ph - (r.G[i] - gmin) / (gmax - gmin || 1) * ph * 0.9; i ? ctx.lineTo(x(d), yy) : ctx.moveTo(x(d), yy); }); ctx.stroke();
    // dd/dt
    ctx.strokeStyle = '#5EEAD4'; ctx.lineWidth = 2; ctx.beginPath();
    r.d.forEach((d, i) => i ? ctx.lineTo(x(d), y(r.f[i])) : ctx.moveTo(x(d), y(r.f[i]))); ctx.stroke();
    // flow arrows on the axis
    ctx.strokeStyle = '#E8F3EC'; ctx.lineWidth = 1.5;
    for (let i = 3; i < r.d.length - 3; i += 6) { const dir = r.f[i] > 0 ? 1 : -1; const xx = x(r.d[i]); ctx.beginPath(); ctx.moveTo(xx - dir * 7, y(0)); ctx.lineTo(xx + dir * 7, y(0)); ctx.stroke(); arrowHead(ctx, xx + dir * 7, y(0), dir > 0 ? 0 : Math.PI, 5); }
    // d_c and d*
    ctx.setLineDash([2, 4]); ctx.strokeStyle = 'rgba(94,234,212,0.6)'; ctx.beginPath(); ctx.moveTo(x(params.dc), pad.t); ctx.lineTo(x(params.dc), pad.t + ph); ctx.stroke(); ctx.setLineDash([]);
    // far-apart silent reference on the G* curve
    const yG = g => pad.t + ph - (g - gmin) / (gmax - gmin || 1) * ph * 0.9;
    if (r.Gfar >= gmin && r.Gfar <= gmax) { ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(255,210,63,0.45)'; ctx.beginPath(); ctx.moveTo(pad.l, yG(r.Gfar)); ctx.lineTo(pad.l + pw, yG(r.Gfar)); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = 'rgba(255,210,63,0.8)'; ctx.font = '10.5px JetBrains Mono, monospace'; ctx.textAlign = 'right'; ctx.fillText('silent, far apart', pad.l + pw - 4, yG(r.Gfar) - 4); }
    ctx.font = '12px JetBrains Mono, monospace'; ctx.textAlign = 'center';
    for (const e of r.equilibria || []) {
      ctx.beginPath(); ctx.arc(x(e.d), y(0), 5.5, 0, Math.PI * 2);
      ctx.fillStyle = e.stable ? '#fff' : '#0F1A14'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#E8F3EC'; ctx.fillText(`${e.stable ? 'd*' : 'unstable'} ≈ ${e.d.toFixed(0)} m`, x(e.d), y(0) + (e.stable ? -12 : 20));
    }
    ctx.fillStyle = '#9BB3A4'; ctx.font = '11px JetBrains Mono, monospace'; ctx.textAlign = 'center';
    for (const d of [100, 300, 500, 700, 900]) if (d <= r.d[r.d.length - 1]) ctx.fillText(d, x(d), H - pad.b + 16);
    ctx.fillStyle = '#E8F3EC'; ctx.font = '12px Inter, sans-serif'; ctx.fillText('separation d (m)', pad.l + pw / 2, H - 6);
    ctx.save(); ctx.translate(14, pad.t + ph / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('dd/dt = η dG*/dd', 0, 0); ctx.restore();
    ctx.textAlign = 'left'; ctx.fillStyle = '#FFD23F'; ctx.font = '11px Inter, sans-serif'; ctx.fillText('G*(d) (scaled)', pad.l + 8, pad.t + 14); ctx.fillStyle = '#5EEAD4'; ctx.fillText('dd/dt', pad.l + 8, pad.t + 28);
    const st = (r.equilibria || []).filter(e => e.stable), un = (r.equilibria || []).filter(e => !e.stable);
    const gain = 100 * (r.Gmax / r.Gfar - 1);
    capEl.textContent = st.length
      ? `Bistable spacing: a stable contact equilibrium d* ≈ ${st[0].d.toFixed(0)} m (${(st[0].d / params.dc).toFixed(2)} d_c, G* = ${st[0].G.toFixed(3)} food/min, ${gain >= 0 ? '+' : ''}${gain.toFixed(1)} % over two silent foragers far apart)${un.length ? ` and an unstable point ≈ ${un[0].d.toFixed(0)} m beyond which the pair drifts apart (fission)` : ''}. Filled dot = stable, hollow = unstable.`
      : `No stable contact equilibrium: dG*/dd > 0 everywhere, so the pair keeps spreading out (coverage beats contact; calls are not worth staying in range for).`;
  }
  frame(ctx, W, H, pad);
  return { async update(params) { if (busy) { queued = params; return; } busy = true; try { const r = await sweep({ type: 'phaseLine', params: { ...params } }); draw(r, params); } catch (e) { console.warn(e); } busy = false; if (queued) { const q = queued; queued = null; this.update(q); } } };
}

export function createPhaseC(canvas, capEl) {
  const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height, pad = { l: 50, r: 16, t: 14, b: 40 };
  let busy = false, queued = null;
  function draw(r, params) {
    frame(ctx, W, H, pad);
    const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b, n = r.h.length;
    const x = h => pad.l + h * pw, y = b => pad.t + (1 - b) * ph;
    let m = 1e-9; for (const row of r.u) for (const v of row) m = Math.max(m, Math.abs(v)); for (const row of r.v) for (const v of row) m = Math.max(m, Math.abs(v));
    const field = (h, b) => {   // bilinear interpolation of (u, v)
      const fi = Math.min(n - 1, Math.max(0, h * (n - 1))), fj = Math.min(n - 1, Math.max(0, b * (n - 1)));
      const i0 = Math.floor(fi), j0 = Math.floor(fj), i1 = Math.min(n - 1, i0 + 1), j1 = Math.min(n - 1, j0 + 1), s = fi - i0, t = fj - j0;
      const L = (z) => (z[j0][i0] * (1 - s) + z[j0][i1] * s) * (1 - t) + (z[j1][i0] * (1 - s) + z[j1][i1] * s) * t;
      return [L(r.u), L(r.v)];
    };
    // arrows
    ctx.strokeStyle = 'rgba(232,243,236,0.55)'; ctx.lineWidth = 1;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const u = r.u[j][i] / m, v = r.v[j][i] / m, L = Math.hypot(u, v); if (L < 1e-6) continue;
      const len = 6 + 12 * Math.sqrt(L), ang = Math.atan2(-v, u), cx = x(r.h[i]), cy = y(r.b[j]);
      ctx.beginPath(); ctx.moveTo(cx - Math.cos(ang) * len / 2, cy - Math.sin(ang) * len / 2); ctx.lineTo(cx + Math.cos(ang) * len / 2, cy + Math.sin(ang) * len / 2); ctx.stroke();
      arrowHead(ctx, cx + Math.cos(ang) * len / 2, cy + Math.sin(ang) * len / 2, ang, 4);
    }
    // streamlines from a few seeds
    ctx.strokeStyle = '#5EEAD4'; ctx.lineWidth = 1.6;
    for (const [h0, b0] of [[0.2, 0.2], [0.8, 0.8], [0.2, 0.8], [0.8, 0.2], [0.5, 0.5], [0.5, 0.9], [0.9, 0.5], [0.1, 0.5], [0.5, 0.1]]) {
      let h = h0, b = b0; ctx.beginPath(); ctx.moveTo(x(h), y(b));
      for (let k = 0; k < 400; k++) { const [u, v] = field(h, b); const L = Math.hypot(u, v) || 1e-9; const step = 0.01; h = Math.min(1, Math.max(0, h + u / L * step)); b = Math.min(1, Math.max(0, b + v / L * step)); ctx.lineTo(x(h), y(b)); if (L / m < 1e-3) break; }
      ctx.stroke();
    }
    // corner equilibria
    const corners = [[0, 0, 'deceptive · sceptical'], [1, 1, 'honest · trusting'], [1, 0, 'honest · sceptical'], [0, 1, 'deceptive · trusting']];
    ctx.font = '11px Inter, sans-serif';
    for (const [h, b, name] of corners) {
      const [u, v] = field(h === 0 ? 0.03 : 0.97, b === 0 ? 0.03 : 0.97);
      const inward = (h === 0 ? u < 0 : u > 0) && (b === 0 ? v < 0 : v > 0);
      ctx.fillStyle = inward ? '#5EEAD4' : '#0F1A14'; ctx.strokeStyle = '#5EEAD4'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x(h), y(b), 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#9BB3A4'; ctx.textAlign = h === 0 ? 'left' : 'right'; ctx.fillText(name, x(h) + (h === 0 ? 10 : -10), y(b) + (b === 0 ? -8 : 16));
    }
    ctx.fillStyle = '#9BB3A4'; ctx.font = '11px JetBrains Mono, monospace'; ctx.textAlign = 'center';
    for (const t of [0, 0.5, 1]) { ctx.fillText(t, x(t), H - pad.b + 16); ctx.textAlign = 'right'; ctx.fillText(t, pad.l - 6, y(t) + 4); ctx.textAlign = 'center'; }
    ctx.fillStyle = '#E8F3EC'; ctx.font = '12px Inter, sans-serif'; ctx.fillText('honesty h', pad.l + pw / 2, H - 6);
    ctx.save(); ctx.translate(14, pad.t + ph / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('trust β', 0, 0); ctx.restore();
    const hh = field(0.97, 0.97)[0] > 0, tt = field(0.97, 0.97)[1] > 0;
    capEl.textContent = `Replicator flow in the symmetric (h, β) square at d = ${params.d.toFixed(0)} m, c = ${params.c.toFixed(1)}, q0 = ${params.q0.toFixed(2)}. Filled corners are attracting. Honest–trusting is ${hh && tt ? 'stable: the value of the partner\'s future tips exceeds the finder\'s-share loss.' : 'not stable here: deception or scepticism pays.'}`;
  }
  frame(ctx, W, H, pad);
  return { async update(params) { if (busy) { queued = params; return; } busy = true; try { const r = await sweep({ type: 'phaseC', params: { ...params }, n: 9 }); draw(r, params); } catch (e) { console.warn(e); } busy = false; if (queued) { const q = queued; queued = null; this.update(q); } } };
}
