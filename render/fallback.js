// render/fallback.js — Canvas2D renderer used automatically when WebGL/WebGPU is unavailable.
// Same API as render/scene.js (render, rebuild, show, cam, sun, dayLength). Simplified art:
// flat ground, circle trees with fruit dots, monkey discs with heading, contact rings, call
// ripples, packets and belief markers. The sim, HUD, charts and Run flow are identical.
import { ARENA } from '../sim/abm.js';
import { AGENT_CSS, QUALITY_CSS } from './palette.js';

const TAU = Math.PI * 2;
export function createFallbackScene(host, world) {
  const canvas = document.createElement('canvas'); canvas.className = 'arena-fallback';
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const show = { rings: true, trails: true, beliefs: true, calls: true, particles: false };
  const ripples = [], packets = [], trails = [[], []];
  let W = 0, H = 0, dpr = 1, time = 0;
  const pos = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
  function resize() {
    dpr = Math.min(2, devicePixelRatio || 1); const r = host.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  }
  new ResizeObserver(resize).observe(host); resize();
  const api = {
    fallback: true, cam: { mode: 'fit', zoom: 1 }, sun: 1, dayLength: 480,
    get show() { return show; },
    rebuild() { ripples.length = 0; packets.length = 0; trails[0].length = 0; trails[1].length = 0; },
    render(alpha, dt) {
      time += dt;
      for (let i = 0; i < 2; i++) { const mk = world.monkeys[i]; pos[i].x = mk.px + (mk.x - mk.px) * alpha; pos[i].y = mk.py + (mk.y - mk.py) * alpha; }
      for (const ev of world.events) {
        if (ev.type === 'call' && show.calls) { ripples.push({ x: pos[ev.caller].x, y: pos[ev.caller].y, age: 0, col: AGENT_CSS[ev.caller], dec: ev.quality === 'deceptive' }); if (ev.heard) packets.push({ x0: pos[ev.caller].x, y0: pos[ev.caller].y, x1: pos[ev.listener].x, y1: pos[ev.listener].y, age: 0, col: ev.acted ? QUALITY_CSS[ev.quality] : '#9bb3a4' }); }
      }
      world.events.length = 0;
      if (W < 2) return;
      const zoom = Math.min(W / (ARENA.w + 40), H / (ARENA.h + 40));
      const ox = (W - ARENA.w * zoom) / 2, oy = (H - ARENA.h * zoom) / 2;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#10201a'; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate(ox, oy); ctx.scale(zoom, zoom);
      ctx.fillStyle = '#233c2c'; ctx.fillRect(0, 0, ARENA.w, ARENA.h);
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      for (const tr of world.trees) { ctx.beginPath(); ctx.ellipse(tr.x + 6, tr.y + 9, tr.r * 1.3, tr.r * 0.7, 0, 0, TAU); ctx.fill(); }
      for (const tr of world.trees) {
        const R = tr.r * 1.25, dep = Math.max(0, Math.min(1, (tr.fruit - 0.05) / 0.6));
        ctx.fillStyle = tr.species ? `hsl(160,${22 + 18 * dep}%,${28 + 10 * dep}%)` : `hsl(118,${22 + 22 * dep}%,${28 + 12 * dep}%)`;
        ctx.beginPath(); ctx.arc(tr.x, tr.y, R, 0, TAU); ctx.fill();
        ctx.fillStyle = tr.species ? 'rgba(138,207,168,.35)' : 'rgba(127,198,94,.35)'; ctx.beginPath(); ctx.arc(tr.x - R * .25, tr.y - R * .3, R * .55, 0, TAU); ctx.fill();
        const n = Math.round(tr.fruit * 10); ctx.fillStyle = tr.fruit >= 0.5 ? '#FFD23F' : 'rgba(201,211,107,.5)';
        for (let k = 0; k < n; k++) { const [a, rf] = tr.fruitSpots[k]; ctx.beginPath(); ctx.arc(tr.x + Math.cos(a) * R * rf * .85, tr.y + Math.sin(a) * R * rf * .7, 2.6, 0, TAU); ctx.fill(); }
      }
      const lw = 1 / zoom;
      // trails
      for (let i = 0; i < 2; i++) { const t = trails[i], p = pos[i]; if (!t.length || Math.hypot(p.x - t[t.length - 1][0], p.y - t[t.length - 1][1]) > 4) { t.push([p.x, p.y]); if (t.length > 60) t.shift(); }
        if (show.trails && t.length > 1) { ctx.strokeStyle = AGENT_CSS[i]; ctx.globalAlpha = .35; ctx.lineWidth = 2 * lw; ctx.beginPath(); t.forEach(([x, y], k) => k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); ctx.globalAlpha = 1; } }
      // contact rings
      if (show.rings) for (let i = 0; i < 2; i++) { ctx.strokeStyle = AGENT_CSS[i]; ctx.globalAlpha = .5; ctx.lineWidth = 1.5 * lw; ctx.beginPath(); ctx.arc(pos[i].x, pos[i].y, world.params.dc, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
      // belief / truth markers
      if (show.beliefs) for (let i = 0; i < 2; i++) { const b = world.monkeys[i].believed; if (!b) continue; const col = b.quality === 'deceptive' ? '#FF4FD8' : AGENT_CSS[i];
        ctx.setLineDash([6 * lw, 4 * lw]); ctx.strokeStyle = col; ctx.lineWidth = 1.8 * lw; ctx.beginPath(); ctx.arc(b.x, b.y, 14 * lw, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(pos[i].x, pos[i].y); ctx.lineTo(b.x, b.y); ctx.globalAlpha = .5; ctx.stroke(); ctx.globalAlpha = 1; ctx.setLineDash([]);
        ctx.strokeStyle = '#F8F6F0'; ctx.beginPath(); ctx.arc(b.truth.x, b.truth.y, 11 * lw, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(b.truth.x - 18 * lw, b.truth.y); ctx.lineTo(b.truth.x + 18 * lw, b.truth.y); ctx.moveTo(b.truth.x, b.truth.y - 18 * lw); ctx.lineTo(b.truth.x, b.truth.y + 18 * lw); ctx.stroke(); }
      // ripples (alpha follows p(r)) and packets
      for (let k = ripples.length - 1; k >= 0; k--) { const r = ripples[k]; r.age += dt; const u = r.age / 1.1; if (u >= 1) { ripples.splice(k, 1); continue; } const rad = 8 + (1 - (1 - u) ** 3) * world.params.dc * 1.25; ctx.strokeStyle = r.dec ? '#FF4FD8' : r.col; ctx.globalAlpha = Math.exp(-((rad / world.params.dc) ** 2)) * (1 - u * .4); ctx.lineWidth = (3 - 2 * u) * lw; ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
      for (let k = packets.length - 1; k >= 0; k--) { const p = packets[k]; p.age += dt; const u = p.age / 0.75; if (u >= 1) { packets.splice(k, 1); continue; } const e = -(Math.cos(Math.PI * u) - 1) / 2; ctx.fillStyle = p.col; for (let s = 0; s < 6; s++) { const uu = Math.max(0, e - s * .04); ctx.globalAlpha = 1 - s / 6; ctx.beginPath(); ctx.arc(p.x0 + (p.x1 - p.x0) * uu, p.y0 + (p.y1 - p.y0) * uu, (5 - s * .6) * lw, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1; }
      // monkeys: disc + heading wedge + label
      for (let i = 0; i < 2; i++) { const mk = world.monkeys[i], p = pos[i], R = 11 * lw, a = Math.atan2(mk.uy, mk.ux);
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(p.x + 3 * lw, p.y + 6 * lw, R * 1.2, R * .6, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = AGENT_CSS[i]; ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a) * R * 1.9, p.y + Math.sin(a) * R * 1.9); ctx.lineTo(p.x + Math.cos(a + 2.4) * R, p.y + Math.sin(a + 2.4) * R); ctx.lineTo(p.x + Math.cos(a - 2.4) * R, p.y + Math.sin(a - 2.4) * R); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#F3E2C7'; ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * R * .5, p.y + Math.sin(a) * R * .5, R * .45, 0, TAU); ctx.fill();
        if (mk.callT > 0) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * lw; ctx.beginPath(); ctx.arc(p.x, p.y, R * 1.6, 0, TAU); ctx.stroke(); }
        ctx.fillStyle = '#fff'; ctx.font = `700 ${13 * lw}px Inter, sans-serif`; ctx.textAlign = 'center'; ctx.fillText(i ? 'B' : 'A', p.x, p.y - R * 1.6);
        const g = mk.emote === 'confused' ? '?' : mk.emote === 'alert' ? '!' : ''; if (g) { ctx.fillStyle = '#FFD36B'; ctx.font = `800 ${18 * lw}px Inter, sans-serif`; ctx.fillText(g, p.x + R * 1.6, p.y - R * 1.6); }
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    },
    screenshot() { return canvas.toDataURL('image/png'); },
  };
  return api;
}
