// render/v3scene.js — illustrative backdrop for model v3: forest, two home ranges (radius R, centres d
// apart), monkeys wandering inside their own range, call ripples between them while both are in the
// overlap (mint = correct, amber = honest mistake, magenta = lie). The numbers come from sim/v3.js only.
import { createWorld, ARENA } from '../sim/abm.js';
import { mulberry32 } from '../sim/rng.js';

const TAU = Math.PI * 2;
const COL = { A: 0xFF8A3D, B: 0x4FB3F6, ok: 0x8FFFD8, wrong: 0xFFD36B, lie: 0xFF4FD8 };
const CSS = { A: '#FF8A3D', B: '#4FB3F6', ok: '#8FFFD8', wrong: '#FFD36B', lie: '#FF4FD8' };

/** Shared, renderer-independent illustration state. */
function makeIllustration(R) {
  const rng = mulberry32(11);
  const st = { d: 130, p: 1, z: 0, ripples: [], nextCall: 1.5 };
  const centre = i => ({ x: ARENA.w / 2 + (i ? 1 : -1) * st.d / 2, y: ARENA.h / 2 });
  const randIn = i => { const c = centre(i), a = rng() * TAU, r = R * 0.92 * Math.sqrt(rng()); return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r }; };
  const mk = [0, 1].map(i => { const p0 = randIn(i); return { id: i, x: p0.x, y: p0.y, px: p0.x, py: p0.y, ux: 1, uy: 0, target: randIn(i), pause: 0, state: 'S', callT: 0, emote: 'search', emoteT: 0, treeRef: null }; });
  const inOther = i => { const c = centre(1 - i); return Math.hypot(mk[i].x - c.x, mk[i].y - c.y) < R; };
  return {
    st, mk, centre,
    step(dt) {
      for (const m of mk) {
        m.px = m.x; m.py = m.y; m.callT -= dt; m.emoteT -= dt;
        const c = centre(m.id);
        if (Math.hypot(m.x - c.x, m.y - c.y) > R) m.target = randIn(m.id);     // range moved under it
        if (m.pause > 0) { m.pause -= dt; m.state = 'O'; continue; }
        m.state = 'S';
        const dx = m.target.x - m.x, dy = m.target.y - m.y, L = Math.hypot(dx, dy), v = 34 * dt;
        if (L < v) { m.x = m.target.x; m.y = m.target.y; m.target = randIn(m.id); m.pause = rng() < 0.4 ? 1 + rng() * 2.5 : 0; continue; }
        m.ux += (dx / L - m.ux) * Math.min(1, dt * 5); m.uy += (dy / L - m.uy) * Math.min(1, dt * 5);
        const n = Math.hypot(m.ux, m.uy) || 1; m.ux /= n; m.uy /= n; m.x += m.ux * v; m.y += m.uy * v;
      }
      for (const r of st.ripples) r.age += dt;
      st.ripples = st.ripples.filter(r => r.age < 1.6);
      st.nextCall -= dt;
      if (st.nextCall <= 0) {
        st.nextCall = 1.4 + rng() * 2.2;
        if (inOther(0) && inOther(1)) {
          const caller = rng() < 0.5 ? 0 : 1;
          const kind = caller === 1 && rng() < st.z ? 'lie' : rng() < st.p ? 'ok' : 'wrong';
          mk[caller].callT = 0.8;
          st.ripples.push({ caller, kind, age: 0 });
        }
      }
    },
  };
}

function rangeTexturePath(g, cx, cy, R, color) {
  g.circle(cx, cy, R).fill({ color, alpha: 0.10 }).stroke({ width: 2, color, alpha: 0.55 });
}

/** PixiJS version (reuses the soft-vector forest and monkey art). */
export async function createV3Scene(host, R) {
  const PIXI = await import('pixi.js');
  const { Application, Container, Graphics } = PIXI;
  const { createForest } = await import('./forest.js');
  const { createMonkey } = await import('./monkey.js');
  const { PostFilter } = await import('./postfx.js');
  const app = new Application();
  await app.init({ preference: 'webgl', resizeTo: host, background: '#0e1b14', antialias: true, resolution: Math.min(devicePixelRatio || 1, 2), autoDensity: true, autoStart: false });
  if (app.renderer.name === 'canvas') throw new Error('no GPU renderer');
  host.appendChild(app.canvas);
  const world = createWorld({ seed: 7 });
  const root = new Container();
  const layers = { ground: new Container(), ranges: new Container(), shadows: new Container(), sorted: new Container(), lights: new Container(), overlay: new Container(), fringe: new Container() };
  layers.sorted.sortableChildren = true;
  root.addChild(layers.ground, layers.ranges, layers.shadows, layers.sorted, layers.lights, layers.overlay, layers.fringe);
  app.stage.addChild(root);
  try { const { AdvancedBloomFilter } = await import('pixi-filters'); layers.lights.filters = [new AdvancedBloomFilter({ threshold: 0.3, bloomScale: 1.1, blur: 8, quality: 4 })]; } catch {}
  let post = null; try { post = new PostFilter(); app.stage.filters = [post]; } catch {}
  const forest = createForest(world, layers, false);
  const monkeys = [createMonkey(0, layers, 'A'), createMonkey(1, layers, 'B')];
  for (const m of monkeys) { m.label.visible = true; }
  const ill = makeIllustration(R);
  const rangeG = new Graphics(); layers.ranges.addChild(rangeG);
  const ripG = new Graphics(); ripG.blendMode = 'add'; layers.lights.addChild(ripG);
  let time = 0, zoom = 1;
  function layout() {
    const W = app.screen.width, H = app.screen.height;
    zoom = Math.max(W / ARENA.w, (H - 0) / ARENA.h) * 1.02;           // cover the viewport
    const cyShift = Math.min(90, H * 0.12);                           // keep the ranges above the bottom panel
    root.scale.set(zoom); root.position.set(W / 2 - ARENA.w / 2 * zoom, H / 2 - ARENA.h / 2 * zoom - cyShift);
  }
  layout(); app.renderer.on('resize', layout);
  return {
    fallback: false, ill,
    frame(dt) {
      time += dt; ill.step(dt);
      rangeG.clear(); for (let i = 0; i < 2; i++) { const c = ill.centre(i); rangeTexturePath(rangeG, c.x, c.y, R, i ? COL.B : COL.A); }
      ripG.clear();
      for (const r of ill.st.ripples) {
        const a = ill.mk[r.caller], b = ill.mk[1 - r.caller], u = r.age / 1.6, col = COL[r.kind];
        for (let k = 0; k < 3; k++) { const uu = Math.max(0, u - k * 0.1); if (uu <= 0) continue; ripG.circle(a.x, a.y, 6 + uu * 120).stroke({ width: (3 - 2.5 * uu) / zoom * 1.2, color: col, alpha: (1 - uu) * 0.8 }); }
        const e = Math.min(1, u / 0.6), px = a.x + (b.x - a.x) * e, py = a.y + (b.y - a.y) * e;
        if (u < 0.7) ripG.circle(px, py, 5).fill({ color: col, alpha: 0.95 });
      }
      forest.update(dt, 1);
      for (let i = 0; i < 2; i++) monkeys[i].update(ill.mk[i], ill.mk[i].x, ill.mk[i].y, dt, time, zoom);
      if (post) post.set(time, 1);
      app.render();
    },
  };
}

/** Canvas2D fallback with the same illustration logic. */
export function createV3Fallback(host, R) {
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'; host.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const world = createWorld({ seed: 7 });
  const ill = makeIllustration(R);
  let W = 1, H = 1, dpr = 1;
  const resize = () => { dpr = Math.min(2, devicePixelRatio || 1); W = host.clientWidth || 1; H = host.clientHeight || 1; canvas.width = W * dpr; canvas.height = H * dpr; };
  new ResizeObserver(resize).observe(host); resize();
  return {
    fallback: true, ill,
    frame(dt) {
      ill.step(dt);
      const zoom = Math.max(W / ARENA.w, H / ARENA.h) * 1.02, shift = Math.min(90, H * 0.12);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#1b3024'; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate(W / 2 - ARENA.w / 2 * zoom, H / 2 - ARENA.h / 2 * zoom - shift); ctx.scale(zoom, zoom);
      ctx.fillStyle = '#233c2c'; ctx.fillRect(0, 0, ARENA.w, ARENA.h);
      for (let i = 0; i < 2; i++) { const c = ill.centre(i); ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, TAU); ctx.fillStyle = i ? 'rgba(79,179,246,.12)' : 'rgba(255,138,61,.12)'; ctx.fill(); ctx.strokeStyle = i ? CSS.B : CSS.A; ctx.globalAlpha = .6; ctx.lineWidth = 2 / zoom; ctx.stroke(); ctx.globalAlpha = 1; }
      for (const tr of world.trees) { const r = tr.r * 1.2; ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(tr.x + 5, tr.y + 8, r * 1.2, r * .65, 0, 0, TAU); ctx.fill(); ctx.fillStyle = tr.species ? '#3f8f72' : '#4c9a4a'; ctx.beginPath(); ctx.arc(tr.x, tr.y, r, 0, TAU); ctx.fill(); ctx.fillStyle = '#FFD23F'; for (let k = 0; k < 7; k++) { const [a, rf] = tr.fruitSpots[k]; ctx.beginPath(); ctx.arc(tr.x + Math.cos(a) * r * rf * .8, tr.y + Math.sin(a) * r * rf * .7, 2.2, 0, TAU); ctx.fill(); } }
      for (const r of ill.st.ripples) { const a = ill.mk[r.caller], b = ill.mk[1 - r.caller], u = r.age / 1.6; ctx.strokeStyle = CSS[r.kind]; ctx.globalAlpha = (1 - u) * .85; ctx.lineWidth = 2.5 / zoom; ctx.beginPath(); ctx.arc(a.x, a.y, 6 + u * 120, 0, TAU); ctx.stroke(); if (u < .7) { const e = Math.min(1, u / .6); ctx.fillStyle = CSS[r.kind]; ctx.beginPath(); ctx.arc(a.x + (b.x - a.x) * e, a.y + (b.y - a.y) * e, 5, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1; }
      for (let i = 0; i < 2; i++) { const m = ill.mk[i], ang = Math.atan2(m.uy, m.ux); ctx.fillStyle = i ? CSS.B : CSS.A; ctx.beginPath(); ctx.arc(m.x, m.y, 10, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(m.x + Math.cos(ang) * 19, m.y + Math.sin(ang) * 19); ctx.lineTo(m.x + Math.cos(ang + 2.4) * 10, m.y + Math.sin(ang + 2.4) * 10); ctx.lineTo(m.x + Math.cos(ang - 2.4) * 10, m.y + Math.sin(ang - 2.4) * 10); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '700 13px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(i ? 'B' : 'A', m.x, m.y - 16); }
      ctx.restore();
    },
  };
}
