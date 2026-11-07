// render/effects.js — science overlays and juice: contact rings, trails, call ripples (alpha
// follows p(r) = exp(-(r/dc)^2)), information packets styled by quality, belief/truth markers,
// fruit pops, sparkles, fireflies (night) and pollen (day). Pooled; no per-frame allocation
// beyond Graphics redraws.
import { Container, Graphics, Sprite } from 'pixi.js';
import { PAL, QUALITY_COLOR, TAU, clamp, easeOutCubic, easeInOutSine } from './palette.js';
import { glowDot, softBlob } from './textures.js';
import { mulberry32 } from '../sim/rng.js';
import { ARENA } from '../sim/abm.js';

function hash(n) { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }

export function createEffects(world, layers, monkeys, opts = {}) {
  const { lights, overlay, shadows } = layers;
  const rng = mulberry32(99);
  const show = { rings: true, trails: true, beliefs: true, calls: true, particles: !opts.reduced, ...opts.show };

  // ---- contact rings + tether ------------------------------------------------
  const rings = [new Graphics(), new Graphics()];
  const tether = new Graphics();
  overlay.addChild(rings[0], rings[1], tether);

  // ---- trails ----------------------------------------------------------------
  const trails = [0, 1].map(() => ({ g: new Graphics(), pts: [], last: null }));
  for (const t of trails) overlay.addChildAt(t.g, 0);

  // ---- belief / truth markers --------------------------------------------------
  const belief = new Graphics(); overlay.addChild(belief);

  // ---- ripples, packets, sparks (pooled lists of plain objects) ----------------
  const ripples = [], packets = [], sparks = [];
  const rippleG = new Graphics(); rippleG.blendMode = 'add'; lights.addChild(rippleG);
  const packetG = new Graphics(); packetG.blendMode = 'add'; lights.addChild(packetG);
  const sparkG = new Graphics(); lights.addChild(sparkG);
  const burstG = new Graphics(); overlay.addChild(burstG);

  // ---- ambient particles: fireflies + pollen (sprites with a glow texture) ----
  const amb = [];
  const N_FF = 34, N_PO = 40;
  for (let k = 0; k < N_FF + N_PO; k++) {
    const sp = new Sprite(glowDot(64)); sp.anchor.set(0.5); sp.blendMode = 'add';
    const firefly = k < N_FF;
    sp.tint = firefly ? PAL.firefly : PAL.pollen;
    const o = { sp, firefly, bx: rng() * ARENA.w, by: rng() * ARENA.h, seed: rng() * 100, sz: firefly ? 7 + rng() * 5 : 4 + rng() * 3, vy: 2 + rng() * 4 };
    sp.width = sp.height = o.sz; lights.addChild(sp); amb.push(o);
  }
  // falling leaves (few, slow)
  const leaves = [];
  const leafG = new Graphics(); overlay.addChildAt(leafG, 0);
  for (let k = 0; k < 10; k++) leaves.push({ x: rng() * ARENA.w, y: rng() * ARENA.h, seed: rng() * 10, v: 6 + rng() * 6, col: rng() < 0.5 ? 0x7FC65E : 0xC9D36B });

  function dashedCircle(g, cx, cy, r, color, w, alpha = 0.9, n = 24) {
    for (let k = 0; k < n; k += 2) {
      const a0 = (k / n) * TAU, a1 = ((k + 1) / n) * TAU;
      g.moveTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r).lineTo(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r).stroke({ width: w, color, alpha, cap: 'round' });
    }
  }
  function dashedLine(g, x0, y0, x1, y1, color, w, alpha, dash = 8, gap = 6, offset = 0) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy); if (L < 1) return;
    const ux = dx / L, uy = dy / L;
    for (let s = -((offset % (dash + gap)) + dash + gap); s < L; s += dash + gap) {
      const a = Math.max(0, s), b = Math.min(L, s + dash); if (b <= a) continue;
      g.moveTo(x0 + ux * a, y0 + uy * a).lineTo(x0 + ux * b, y0 + uy * b).stroke({ width: w, color, alpha, cap: 'round' });
    }
  }
  function arrow(g, x0, y0, x1, y1, color, w, alpha) {
    g.moveTo(x0, y0).lineTo(x1, y1).stroke({ width: w, color, alpha });
    const a = Math.atan2(y1 - y0, x1 - x0), h = 6;
    g.moveTo(x1, y1).lineTo(x1 - Math.cos(a - 0.5) * h, y1 - Math.sin(a - 0.5) * h).moveTo(x1, y1).lineTo(x1 - Math.cos(a + 0.5) * h, y1 - Math.sin(a + 0.5) * h).stroke({ width: w, color, alpha });
  }

  let time = 0, dashOff = 0;
  const api = {
    show, ripples, packets,
    /** Drain world.events (called once per frame). pos(i) gives the render position of monkey i. */
    consume(events, pos) {
      for (const ev of events) {
        switch (ev.type) {
          case 'call': {
            const p = pos(ev.caller);
            if (show.calls) ripples.push({ x: p.x, y: p.y, age: 0, life: 1.1, color: PAL.agent[ev.caller], deceptive: ev.quality === 'deceptive', heard: ev.heard });
            if (ev.heard && show.calls) {
              const to = pos(ev.listener);
              packets.push({ x0: p.x, y0: p.y, x1: to.x, y1: to.y, age: 0, life: 0.75, quality: ev.quality, acted: ev.acted, listener: ev.listener, caller: ev.caller, seed: rng() * 1000, reason: ev.reason });
            }
            break;
          }
          case 'eat': { const p = pos(ev.monkey); spawnSparks(p.x + 10, p.y - 6, 5, PAL.fruit, 40); break; }
          case 'found': { const tr = world.trees[ev.tree]; spawnBurst(tr.x, tr.y - 6, 0xffffff, 28, 0.6); break; }
          case 'arrive': if (!ev.own) { const tr = world.trees[ev.tree]; spawnBurst(tr.x, tr.y, PAL.agent[ev.monkey], 22, 0.5); } break;
          case 'misled': { spawnBurst(ev.x, ev.y, ev.quality === 'deceptive' ? PAL.deception : PAL.inaccurate, 26, 0.7, true); spawnSparks(ev.x, ev.y - 10, 6, 0x9bb3a4, 20); break; }
          case 'exhausted': { const tr = world.trees[ev.tree]; spawnSparks(tr.x, tr.y, 8, 0xC9D36B, 26); break; }
        }
      }
    },
    update(dt, zoom, sun, pos, sepStress) {
      time += dt; dashOff += dt * 40;
      const w = 1 / zoom;
      const dc = world.params.dc;
      // contact rings
      for (let i = 0; i < 2; i++) {
        const g = rings[i]; g.clear(); if (!show.rings) continue;
        const p = pos(i), col = PAL.agent[i];
        const alert = sepStress > 0.8 ? (sepStress - 0.8) / 0.2 : 0;
        const pulse = alert > 0 ? 0.5 + 0.5 * Math.sin(time * 7) : 0;
        g.circle(p.x, p.y, dc).fill({ color: col, alpha: 0.035 + 0.02 * pulse * alert }).stroke({ width: (1.4 + 1.2 * pulse * alert) * w, color: col, alpha: 0.45 + 0.35 * pulse * alert });
        // tick marks at the cardinal points so the radius reads as a measured quantity
        for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; g.moveTo(p.x + Math.cos(a) * (dc - 6 * w), p.y + Math.sin(a) * (dc - 6 * w)).lineTo(p.x + Math.cos(a) * (dc + 6 * w), p.y + Math.sin(a) * (dc + 6 * w)).stroke({ width: 1.2 * w, color: col, alpha: 0.6 }); }
      }
      // tether between the pair: appears as they approach the edge of contact
      tether.clear();
      if (show.rings) {
        const a = pos(0), b = pos(1);
        const al = clamp((sepStress - 0.5) / 0.5, 0, 1);
        if (al > 0) dashedLine(tether, a.x, a.y, b.x, b.y, sepStress > 1 ? PAL.deception : 0xffffff, 1.3 * w, 0.18 + 0.4 * al, 10 * w, 8 * w, dashOff * w);
      }
      // trails (distance-spaced ring buffer)
      for (let i = 0; i < 2; i++) {
        const t = trails[i], p = pos(i);
        if (!t.last || Math.hypot(p.x - t.last[0], p.y - t.last[1]) > 4) { t.pts.push([p.x, p.y]); t.last = [p.x, p.y]; if (t.pts.length > 70) t.pts.shift(); }
        t.g.clear(); if (!show.trails) continue;
        const n = t.pts.length;
        for (let k = 1; k < n; k++) {
          const f = k / n;
          t.g.moveTo(t.pts[k - 1][0], t.pts[k - 1][1]).lineTo(t.pts[k][0], t.pts[k][1]).stroke({ width: (0.8 + 2.4 * f) * w, color: PAL.agent[i], alpha: 0.45 * f * f, cap: 'round' });
        }
      }
      // belief / truth markers
      belief.clear();
      if (show.beliefs) for (let i = 0; i < 2; i++) {
        const mk = world.monkeys[i], p = pos(i);
        if (mk.state === 'G' && mk.tree >= 0) {       // own found tree: faint target line
          const tr = world.trees[mk.tree];
          dashedLine(belief, p.x, p.y, tr.x, tr.y, PAL.agent[i], 1 * w, 0.35, 6 * w, 6 * w, dashOff * w);
        }
        if (!mk.believed) continue;
        const b = mk.believed, dec = b.quality === 'deceptive', col = dec ? PAL.deception : PAL.agent[i];
        // believed location: dashed ring in the owner's colour (magenta when deceived)
        dashedCircle(belief, b.x, b.y, 11 * w + 4, col, 1.8 * w, 0.95);
        belief.circle(b.x, b.y, 2.2 * w).fill({ color: col, alpha: 0.9 });
        dashedLine(belief, p.x, p.y, b.x, b.y, col, 1.2 * w, 0.45, 8 * w, 6 * w, dashOff * w);
        // truth: solid warm-white ring + crosshair at the real patch
        const t = b.truth, r = 9 * w + 4;
        belief.circle(t.x, t.y, r).stroke({ width: 1.8 * w, color: PAL.truth, alpha: 0.95 });
        belief.moveTo(t.x - r * 1.5, t.y).lineTo(t.x - r * 0.6, t.y).moveTo(t.x + r * 0.6, t.y).lineTo(t.x + r * 1.5, t.y)
          .moveTo(t.x, t.y - r * 1.5).lineTo(t.x, t.y - r * 0.6).moveTo(t.x, t.y + r * 0.6).lineTo(t.x, t.y + r * 1.5).stroke({ width: 1.4 * w, color: PAL.truth, alpha: 0.9 });
        // error vector belief → truth (shows the cost of the bad information)
        if (b.quality !== 'accurate') arrow(belief, b.x, b.y, t.x, t.y, col, 1.2 * w, 0.5);
        if (dec) { belief.moveTo(b.x - 5 * w, b.y - 18 * w).lineTo(b.x + 5 * w, b.y - 18 * w); }
      }
      // ripples: alpha ∝ p(r) = exp(-(r/dc)^2), three staggered rings
      rippleG.clear();
      for (let k = ripples.length - 1; k >= 0; k--) {
        const r = ripples[k]; r.age += dt; if (r.age > r.life) { ripples.splice(k, 1); continue; }
        for (let j = 0; j < 3; j++) {
          const u = clamp((r.age - j * 0.12) / (r.life - 0.24), 0, 1); if (u <= 0) continue;
          const rad = 8 + easeOutCubic(u) * dc * 1.25;
          const pr = Math.exp(-(rad / dc) * (rad / dc));
          const col = r.deceptive ? PAL.deception : r.color;
          rippleG.circle(r.x, r.y, rad).stroke({ width: (3.2 - 2.4 * u) * w, color: col, alpha: (0.9 - 0.3 * j) * pr * (1 - u * 0.4) });
        }
      }
      // packets caller → listener
      packetG.clear();
      for (let k = packets.length - 1; k >= 0; k--) {
        const p = packets[k]; p.age += dt; const u = p.age / p.life;
        if (u >= 1) { if (p.acted) spawnBurst(p.x1, p.y1, QUALITY_COLOR[p.quality], 18, 0.45); packets.splice(k, 1); continue; }
        const q = p.acted ? p.quality : 'ignored';
        const col = p.acted ? QUALITY_COLOR[p.quality] : 0x9bb3a4;
        const dx = p.x1 - p.x0, dy = p.y1 - p.y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
        const jit = q === 'inaccurate' ? 10 : q === 'deceptive' ? 14 : q === 'vague' ? 4 : 0;
        const fade = p.acted ? 1 : 1 - u * u;    // ignored/busy packets dissolve
        for (let s = 0; s < 14; s++) {
          const uu = clamp(u - s * 0.025, 0, 1), e = easeInOutSine(uu);
          const h = hash(p.seed + Math.floor(uu * 60) + s * 3.7) - 0.5;
          const off = jit * h * w * 2 * (q === 'vague' ? Math.sin(uu * 20) : 1);
          const x = p.x0 + dx * e + nx * off, y = p.y0 + dy * e + ny * off;
          const a = (1 - s / 14) * fade * (q === 'deceptive' && hash(p.seed + Math.floor(time * 30)) < 0.25 ? 0.3 : 1);
          const rad = (q === 'vague' ? 7 - s * 0.3 : 4.5 - s * 0.25) * w;
          packetG.circle(x, y, Math.max(0.6 * w, rad)).fill({ color: col, alpha: a * (q === 'vague' ? 0.45 : 0.9) });
          if (q === 'deceptive' && s === 0 && hash(p.seed + Math.floor(time * 20)) < 0.5) packetG.rect(x - 9 * w, y + (h * 10) * w, 18 * w, 1.6 * w).fill({ color: 0xffffff, alpha: 0.7 });
        }
        // guide line: solid for accurate, dashed otherwise
        if (q === 'accurate') packetG.moveTo(p.x0, p.y0).lineTo(p.x1, p.y1).stroke({ width: 0.8 * w, color: col, alpha: 0.18 * fade });
        else dashedLine(packetG, p.x0, p.y0, p.x1, p.y1, col, 0.8 * w, 0.2 * fade, 6 * w, 6 * w, 0);
      }
      // sparks + bursts
      sparkG.clear(); burstG.clear();
      for (let k = sparks.length - 1; k >= 0; k--) {
        const s = sparks[k]; s.age += dt; const u = s.age / s.life; if (u >= 1) { sparks.splice(k, 1); continue; }
        if (s.burst) {
          const rad = 4 + easeOutCubic(u) * s.r;
          if (s.dashed) dashedCircle(burstG, s.x, s.y, rad, s.col, 2 * (1 - u) * w + 0.5, 1 - u, 20);
          else burstG.circle(s.x, s.y, rad).stroke({ width: (2.5 * (1 - u) + 0.5) * w, color: s.col, alpha: 1 - u });
        } else {
          s.vy += 60 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
          sparkG.circle(s.x, s.y, 2.2 * (1 - u) * w + 0.5).fill({ color: s.col, alpha: 1 - u });
        }
      }
      // ambient particles
      const night = 1 - sun;
      for (const o of amb) {
        const sp = o.sp;
        if (!show.particles) { sp.visible = false; continue; }
        sp.visible = true;
        if (o.firefly) {
          sp.x = o.bx + Math.sin(time * 0.35 + o.seed) * 45 + Math.sin(time * 0.9 + o.seed * 2) * 12;
          sp.y = o.by + Math.cos(time * 0.27 + o.seed * 1.3) * 32;
          sp.alpha = Math.pow(Math.max(0, 0.5 + 0.5 * Math.sin(time * 1.7 + o.seed * 7)), 3) * night * 0.95;
        } else {
          o.by += o.vy * dt; if (o.by > ARENA.h + 20) o.by = -20;
          sp.x = o.bx + Math.sin(time * 0.5 + o.seed) * 20; sp.y = o.by;
          sp.alpha = (0.35 + 0.35 * Math.sin(time * 1.1 + o.seed)) * sun * 0.5;
        }
        sp.width = sp.height = o.sz * (o.firefly ? 1 : 0.8);
      }
      leafG.clear();
      if (show.particles) for (const l of leaves) {
        l.y += l.v * dt; l.x += Math.sin(time * 1.3 + l.seed) * 14 * dt; if (l.y > ARENA.h + 20) { l.y = -20; l.x = rng() * ARENA.w; }
        const rot = time * 2 + l.seed, sq = Math.abs(Math.sin(time * 2.5 + l.seed));
        leafG.ellipse(l.x, l.y, 4.5, 2.2 * sq + 0.5).fill({ color: l.col, alpha: 0.55 });
        void rot;
      }
    },
  };
  function spawnSparks(x, y, n, col, sp) {
    for (let k = 0; k < n; k++) { const a = rng() * TAU, s = sp * (0.5 + rng()); sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, age: 0, life: 0.35 + rng() * 0.3, col }); }
  }
  function spawnBurst(x, y, col, r, life, dashed = false) { sparks.push({ x, y, age: 0, life, col, r, burst: true, dashed }); }
  return api;
}
