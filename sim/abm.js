// sim/abm.js — 2-D agent-based realisation of the Layer A model (MODEL_SPEC §3), plus a Layer A
// ODE companion integrated with the same parameters so the page can show ABM vs ODE agreement.
// DOM-free and seeded: the same seed + parameters give the same run (video retakes, tests).
//
// Discrete states mirror the compartments: 'S' searching, 'G' walking to an own-found patch
// (travel that Layer A neglects), 'O' feeding at own patch, 'W' walking to partner's patch,
// 'J' joined, 'M' misled (walking to a believed location, then local search for τg).
import { mulberry32, expRand, gaussRand } from './rng.js';
import { makeSimplex, fbm, poissonDisk } from './noise.js';
import { baseParams, rates, initialState, makeRK4, intake, NV } from './model.js';

const TAU = Math.PI * 2;
export const ARENA = Object.freeze({ w: 1000, h: 640, margin: 36 });
export const STATES = ['S', 'O', 'W', 'J', 'M'];

export const abmDefaults = Object.freeze({
  seed: 7,
  treeSpacing: 64,       // Poisson-disk radius, m
  findRadius: 130,       // a discovery picks the nearest fruiting tree within this radius, m
  regrow: 1 / 90,        // logistic regrowth rate of a patch, 1/min
  fruitThreshold: 0.5,   // a patch counts as "fruiting" above this level
  turnSigma: 0.9,        // CRW heading noise, rad/sqrt(min)
  sepGain: 2.2,          // steering gain toward the target separation
});

export function createWorld({ seed = abmDefaults.seed, params = {}, options = {} } = {}) {
  const opt = { ...abmDefaults, ...options, seed };
  const p = { ...baseParams, ...params };
  const rng = mulberry32(seed);
  const noise = makeSimplex(rng);

  // ---- forest -------------------------------------------------------------
  const m = ARENA.margin;
  const pts = poissonDisk(ARENA.w - 2 * m, ARENA.h - 2 * m, opt.treeSpacing, rng);
  const trees = pts.map(([x, y], k) => {
    const nx = (x + m) / ARENA.w, ny = (y + m) / ARENA.h;
    const species = fbm(noise, nx * 2.3, ny * 2.3) > 0.05 ? 1 : 0;   // 0 Ficus (warm), 1 Ramón (cool)
    return {
      id: k, x: x + m, y: y + m, r: 15 + rng() * 11, species,
      fruit: 0.55 + rng() * 0.45, claimed: -1, feeders: 0, exhausted: false, phase: rng() * TAU,
      lobes: Array.from({ length: 8 }, () => [(rng() - 0.5), (rng() - 0.5), 0.45 + rng() * 0.4]),
      fruitSpots: Array.from({ length: 14 }, () => [rng() * TAU, 0.35 + rng() * 0.55]),
    };
  });

  // ---- monkeys ------------------------------------------------------------
  function makeMonkey(i, x, y) {
    const a = rng() * TAU;
    return {
      id: i, x, y, ux: Math.cos(a), uy: Math.sin(a), vx: 0, vy: 0, speed: 0,
      state: 'S', tree: -1, target: null, believed: null, timer: 0, localT: 0, feedAngle: 0,
      food: 0, foodAt: 0, emote: 'idle', emoteT: 0, callT: 0,
      stats: { found: 0, calls: 0, heard: 0, tipsFollowed: 0, joined: 0, misled: 0, lost: 0 },
      timeIn: { S: 0, O: 0, W: 0, J: 0, M: 0 },
    };
  }
  const cx = ARENA.w / 2, cy = ARENA.h / 2;
  const monkeys = [makeMonkey(0, cx - p.d / 2, cy + 20), makeMonkey(1, cx + p.d / 2, cy - 20)];

  // ---- ODE companion -------------------------------------------------------
  const rk4 = makeRK4(NV);
  const ode = { y: initialState(), yn: new Float64Array(NV), e: new Float64Array(2), cum: [0, 0] };

  const world = {
    t: 0, params: p, options: opt, trees, monkeys, ode, rng, seed,
    events: [],
    separation: p.d,
    rates: rates(p),
    get food() { return [monkeys[0].food, monkeys[1].food]; },

    step(dt) {
      this.t += dt;
      const r = this.rates = rates(p);
      const A = monkeys[0], B = monkeys[1];
      const dx = B.x - A.x, dy = B.y - A.y;
      const dAct = Math.hypot(dx, dy);
      this.separation = dAct;
      const lamAct = p.lambda0 * (1 - 0.5 * Math.exp(-dAct / p.ls));
      const pHeard = Math.exp(-((dAct / p.dc) ** 2));

      for (let i = 0; i < 2; i++) {
        const mk = monkeys[i], pt = monkeys[1 - i];
        mk.timeIn[mk.state === 'G' ? 'S' : mk.state] += dt;
        mk.emoteT -= dt; mk.callT -= dt;
        switch (mk.state) {
          case 'S': {
            searchWalk(mk, pt, dt, dAct);
            if (rng() < lamAct * dt) {
              const k = nearestFruitingTree(mk.x, mk.y, opt.findRadius);
              if (k >= 0) {
                mk.tree = k; trees[k].claimed = i; mk.state = 'G';
                mk.target = treeSeat(trees[k], mk, 0);
                mk.stats.found++;
                this.events.push({ type: 'found', monkey: i, tree: k, t: this.t });
              }
            }
            break;
          }
          case 'G': {
            if (walkTo(mk, mk.target, dt, p.v)) {
              const tr = trees[mk.tree];
              mk.state = 'O'; mk.timer = expRand(rng, p.mu); mk.speed = 0; tr.feeders++;
              mk.feedRate = tr.fruit / Math.max(mk.timer, 1);   // visual depletion
              mk.emote = 'feed';
              this.events.push({ type: 'arrive', monkey: i, tree: mk.tree, own: true, t: this.t });
            }
            break;
          }
          case 'O': {
            const tr = trees[mk.tree];
            const partnerJoined = pt.state === 'J' && pt.tree === mk.tree;
            const rate = partnerJoined ? p.g * r.s2 : p.g;
            mk.food += rate * dt; mk.foodAt += rate * dt;
            tr.fruit = Math.max(0.02, tr.fruit - mk.feedRate * dt);
            if (mk.foodAt >= 1.2) { mk.foodAt = 0; this.events.push({ type: 'eat', monkey: i, tree: mk.tree, t: this.t }); }
            if (rng() < p.sigma * dt) this.emitCall(i, pHeard);
            mk.timer -= dt;
            if (mk.timer <= 0) this.exhaust(mk.tree);
            break;
          }
          case 'W': {
            if (walkTo(mk, mk.target, dt, p.v)) {
              const tr = trees[mk.tree];
              mk.state = 'J'; mk.speed = 0; tr.feeders++; mk.stats.joined++; mk.emote = 'feed';
              this.events.push({ type: 'arrive', monkey: i, tree: mk.tree, own: false, t: this.t });
            }
            break;
          }
          case 'J': {
            const rate = p.g * r.s2;
            mk.food += rate * dt; mk.foodAt += rate * dt;
            if (mk.foodAt >= 1.2) { mk.foodAt = 0; this.events.push({ type: 'eat', monkey: i, tree: mk.tree, t: this.t }); }
            break;
          }
          case 'M': {
            if (mk.localT > 0) {
              // local search around the believed location: slow wander in a small circle
              mk.localT -= dt;
              mk.phaseL = (mk.phaseL || 0) + dt * 0.9;
              const rr = 22;
              const tx = mk.believed.x + Math.cos(mk.phaseL) * rr, ty = mk.believed.y + Math.sin(mk.phaseL * 1.3) * rr;
              walkTo(mk, { x: tx, y: ty }, dt, p.v * 0.55, true);
              if (mk.localT <= 0) {
                mk.state = 'S'; mk.believed = null; mk.target = null; mk.emote = 'idle';
                this.events.push({ type: 'giveup', monkey: i, t: this.t });
              }
            } else if (walkTo(mk, mk.target, dt, p.v)) {
              mk.localT = p.tauG; mk.emote = 'confused'; mk.emoteT = 4;
              this.events.push({ type: 'misled', monkey: i, x: mk.x, y: mk.y, quality: mk.believed.quality, t: this.t });
            }
            break;
          }
        }
        if (mk.emoteT <= 0 && mk.emote === 'confused') mk.emote = mk.state === 'M' ? 'search' : 'idle';
      }

      // patches regrow logistically (A9: no faster depletion with two feeders)
      for (const tr of trees) {
        if (tr.claimed < 0) {
          tr.fruit += opt.regrow * tr.fruit * (1 - tr.fruit) * dt;
          if (tr.exhausted && tr.fruit > opt.fruitThreshold) tr.exhausted = false;
        }
      }

      // Layer A companion with the same parameters (d = target separation)
      rk4(ode.y, p, dt, ode.yn); ode.y.set(ode.yn);
      intake(ode.y, p, ode.e);
      ode.cum[0] += ode.e[0] * dt; ode.cum[1] += ode.e[1] * dt;
    },

    emitCall(i, pHeard) {
      const caller = monkeys[i], listener = monkeys[1 - i];
      caller.stats.calls++; caller.callT = 0.9; caller.emote = 'call'; caller.emoteT = 0.9;
      const heard = rng() < pHeard;
      const ev = { type: 'call', caller: i, listener: 1 - i, heard, acted: false, quality: null, x: caller.x, y: caller.y, t: this.t, reason: 'unheard' };
      const tr = trees[caller.tree];
      ev.tree = caller.tree;
      if (heard) {
        listener.stats.heard++;
        const beta = i === 0 ? p.beta2 : p.beta1;   // listener's trust
        if (listener.state !== 'S') ev.reason = 'busy';
        else if (rng() >= beta) ev.reason = 'ignored';
        else {
          const honest = rng() < (i === 0 ? p.h1 : p.h2);
          const accurate = rng() < (i === 0 ? p.eps1 : p.eps2);
          const locatable = rng() < p.q0;
          const quality = !honest ? 'deceptive' : !accurate ? 'inaccurate' : !locatable ? 'vague' : 'accurate';
          ev.acted = true; ev.quality = quality; ev.reason = 'acted';
          listener.stats.tipsFollowed++;
          if (quality === 'accurate') {
            listener.state = 'W'; listener.tree = caller.tree;
            listener.target = treeSeat(tr, listener, 1);
            listener.believed = { x: tr.x, y: tr.y, tree: caller.tree, quality, truth: { x: tr.x, y: tr.y } };
          } else {
            listener.state = 'M'; listener.localT = 0; listener.stats.misled++;
            listener.believed = { ...falseLocation(quality, tr, listener, caller), quality, truth: { x: tr.x, y: tr.y }, tree: caller.tree };
            listener.target = { x: listener.believed.x, y: listener.believed.y };
          }
          listener.emote = 'alert'; listener.emoteT = 1.2;
          ev.to = { x: listener.believed.x, y: listener.believed.y };
        }
      }
      this.events.push(ev);
    },

    exhaust(k) {
      const tr = trees[k];
      tr.fruit = 0.02; tr.exhausted = true; tr.claimed = -1; tr.feeders = 0;
      for (const mk of monkeys) {
        if (mk.tree !== k) continue;
        if (mk.state === 'W') { mk.stats.lost++; this.events.push({ type: 'lost', monkey: mk.id, t: this.t }); }
        mk.state = 'S'; mk.tree = -1; mk.target = null; mk.believed = null; mk.emote = 'idle';
        // leave in a fresh direction
        const a = rng() * TAU; mk.ux = Math.cos(a); mk.uy = Math.sin(a);
      }
      this.events.push({ type: 'exhausted', tree: k, t: this.t });
    },

    setParam(key, value) { p[key] = value; this.rates = rates(p); },
    setParams(obj) { Object.assign(p, obj); this.rates = rates(p); },

    /** Running averages for charts: ABM intake, ODE intake, compartment fractions. */
    summary() {
      const t = Math.max(this.t, 1e-9);
      const abm = [monkeys[0].food / t, monkeys[1].food / t];
      const odeAvg = [ode.cum[0] / t, ode.cum[1] / t];
      const frac = monkeys.map(mk => { const o = {}; for (const s of STATES) o[s] = mk.timeIn[s] / t; return o; });
      return { t: this.t, abm, odeAvg, odeNow: [ode.e[0], ode.e[1]], odeY: ode.y, frac, separation: this.separation };
    },
  };

  // ---- helpers (closures over world data) -----------------------------------
  function nearestFruitingTree(x, y, R) {
    let best = -1, bd = R;
    for (const tr of trees) {
      if (tr.claimed >= 0 || tr.fruit < opt.fruitThreshold) continue;
      const dd = Math.hypot(tr.x - x, tr.y - y);
      if (dd < bd) { bd = dd; best = tr.id; }
    }
    return best;
  }
  function treeSeat(tr, mk, slot) {
    const a = Math.atan2(mk.y - tr.y, mk.x - tr.x) + (slot ? 1.9 : 0);
    mk.feedAngle = a;
    return { x: tr.x + Math.cos(a) * tr.r * 0.55, y: tr.y + Math.sin(a) * tr.r * 0.55 };
  }
  function clampArena(pt) {
    pt.x = Math.min(ARENA.w - m, Math.max(m, pt.x));
    pt.y = Math.min(ARENA.h - m, Math.max(m, pt.y));
    return pt;
  }
  function falseLocation(quality, tr, listener, caller) {
    if (quality === 'deceptive') {
      // the liar points away from the patch: ≈ d away from the listener, 90–150° off the true bearing
      const dxx = caller.x - listener.x, dyy = caller.y - listener.y;
      const dist = Math.max(60, Math.hypot(dxx, dyy));
      const ang = Math.atan2(dyy, dxx) + (rng() < 0.5 ? 1 : -1) * (Math.PI / 2 + rng() * Math.PI / 3);
      return clampArena({ x: listener.x + Math.cos(ang) * dist, y: listener.y + Math.sin(ang) * dist });
    }
    const mag = quality === 'vague' ? 70 + rng() * 90 : 60 + rng() * 110;
    const ang = rng() * TAU;
    return clampArena({ x: tr.x + Math.cos(ang) * mag, y: tr.y + Math.sin(ang) * mag });
  }
  /** Move toward target at speed; returns true on arrival. */
  function walkTo(mk, target, dt, speed, soft = false) {
    const dxx = target.x - mk.x, dyy = target.y - mk.y, dist = Math.hypot(dxx, dyy);
    const stepLen = speed * dt;
    if (dist <= Math.max(stepLen * 1.5, 3)) {
      if (!soft) { mk.x = target.x; mk.y = target.y; }
      mk.vx = 0; mk.vy = 0; mk.speed = 0;
      return true;
    }
    const ux = dxx / dist, uy = dyy / dist;
    // smooth heading toward target (prevents instant flips); snap when close so we never orbit it
    const k = dist < 20 ? 1 : Math.min(1, dt * 8);
    mk.ux += (ux - mk.ux) * k; mk.uy += (uy - mk.uy) * k;
    const n = Math.hypot(mk.ux, mk.uy) || 1; mk.ux /= n; mk.uy /= n;
    mk.x += mk.ux * stepLen; mk.y += mk.uy * stepLen;
    mk.vx = mk.ux * speed; mk.vy = mk.uy * speed; mk.speed = speed;
    return false;
  }
  /** Correlated random walk + steering to hold the target separation, inside the arena. */
  function searchWalk(mk, pt, dt, dAct) {
    const noiseA = gaussRand(rng) * opt.turnSigma * Math.sqrt(dt);
    const ca = Math.cos(noiseA), sa = Math.sin(noiseA);
    let ux = mk.ux * ca - mk.uy * sa, uy = mk.ux * sa + mk.uy * ca;
    // separation steering: pull in when too far, push out when too close
    const sx = pt.x - mk.x, sy = pt.y - mk.y, sd = Math.max(dAct, 1e-6);
    const err = (sd - p.d) / Math.max(p.d, 30);
    const w = Math.max(-1, Math.min(1, err)) * opt.sepGain;
    ux += (sx / sd) * w * dt * 3; uy += (sy / sd) * w * dt * 3;
    // arena edge avoidance
    const e = 80;
    if (mk.x < m + e) ux += ((m + e - mk.x) / e) * dt * 4;
    if (mk.x > ARENA.w - m - e) ux -= ((mk.x - (ARENA.w - m - e)) / e) * dt * 4;
    if (mk.y < m + e) uy += ((m + e - mk.y) / e) * dt * 4;
    if (mk.y > ARENA.h - m - e) uy -= ((mk.y - (ARENA.h - m - e)) / e) * dt * 4;
    const n = Math.hypot(ux, uy) || 1; mk.ux = ux / n; mk.uy = uy / n;
    mk.x += mk.ux * p.v * dt; mk.y += mk.uy * p.v * dt;
    clampArena(mk);
    mk.vx = mk.ux * p.v; mk.vy = mk.uy * p.v; mk.speed = p.v;
    if (mk.emote === 'idle' || mk.emote === 'feed') mk.emote = 'search';
  }

  return world;
}
