// sim/model.js — Layer A / B / C of the "Coverage–Contact–Trust" model (MODEL_SPEC.md v1).
// PURE: no DOM, no globals, no randomness. Plain functions over Float64Arrays so it runs in
// Node (unit tests), in a Web Worker (sweeps) and in the page (live ODE companion to the ABM).
//
// State layout (NV = 10):  [S1, O1, W1, J1, M1,  S2, O2, W2, J2, M2]
//   S searching · O feeding at own patch · W walking to partner's patch · J joined · M misled.

export const NV = 10;

/** Baseline parameters (MODEL_SPEC §6). Time in minutes, distance in metres, food in units of g. */
export const baseParams = Object.freeze({
  mu: 1 / 15,       // patch residence (feed) rate, 1/min
  lambda0: 1 / 30,  // solo discovery rate while searching, 1/min
  ls: 150,          // coverage-redundancy scale, m
  sigma: 1 / 5,     // call rate while feeding at own patch, 1/min
  dc: 300,          // call active space, m
  v: 30,            // travel speed, m/min
  tauG: 10,         // give-up time after a false lead, min
  dmin: 10,         // min separation in travel-time formula, m
  c: 2.5,           // patch capacity (animal-equivalents) — AM1
  k: 0,             // shared-fate / relatedness weight in the Layer C payoff π_i = G_i + k G_j — AM3
  q0: 0.8,          // detail / locatability
  eps1: 0.9, eps2: 0.9,   // perceptual accuracy
  h1: 1, h2: 1,           // honesty
  beta1: 1, beta2: 1,     // trust
  g: 1,             // feeding rate at a patch (normalisation)
  d: 200,           // separation (parameter in Layer A, slow state in Layer B)
  eta: 1, rh: 1, rbeta: 1,  // adaptation rates of the slow layers
  ka: 0, dsoc: 150, // optional social-attraction extension (ka = 0 at baseline)
});

/** Derived rates for a parameter set (MODEL_SPEC §2). */
export function rates(p) {
  const d = p.d;
  const lambda = p.lambda0 * (1 - 0.5 * Math.exp(-d / p.ls));
  const pd = Math.exp(-(d / p.dc) * (d / p.dc));
  const T = p.sigma * pd;
  const omega = p.v / Math.max(d, p.dmin);
  const nu = 1 / (d / p.v + p.tauG);
  const a1 = p.eps1 * p.h1, a2 = p.eps2 * p.h2;
  const s2 = Math.min(1, p.c / 2);
  return { lambda, pd, T, omega, nu, a1, a2, s2 };
}

/** All-searching initial condition. */
export function initialState() {
  const y = new Float64Array(NV);
  y[0] = 1; y[5] = 1;
  return y;
}

/** dy/dt = f(y, p); writes into `out` (allocation-free). */
export function derivs(y, p, out) {
  const r = rates(p);
  const { lambda, T, omega, nu, s2 } = r;
  const mu = p.mu;
  for (let i = 0; i < 2; i++) {
    const o = i * 5, oj = (1 - i) * 5;
    const S = y[o], O = y[o + 1], W = y[o + 2], J = y[o + 3], M = y[o + 4];
    const Oj = y[oj + 1];
    const beta = i === 0 ? p.beta1 : p.beta2;
    const aj = i === 0 ? r.a2 : r.a1;           // partner's truthfulness
    const tips = beta * T * Oj * S;             // tips acted on per unit time
    const good = aj * p.q0;                     // fraction that lead to the patch
    out[o]     = -lambda * S - tips + mu * (O + J + W) + nu * M;
    out[o + 1] =  lambda * S - mu * O;
    out[o + 2] =  tips * good - (omega + mu) * W;
    out[o + 3] =  omega * W - mu * J;
    out[o + 4] =  tips * (1 - good) - nu * M;
  }
  void s2;
  return out;
}

/** Intake rates e_i (food per minute) for the state y (MODEL_SPEC §2). */
export function intake(y, p, out = new Float64Array(2)) {
  const s2 = Math.min(1, p.c / 2);
  for (let i = 0; i < 2; i++) {
    const o = i * 5, oj = (1 - i) * 5;
    out[i] = p.g * (y[o + 1] - (1 - s2) * y[oj + 3] + s2 * y[o + 3]);
  }
  return out;
}

/** Classic RK4 with preallocated scratch. Returns a stepper(y, p, h, yNext). */
export function makeRK4(n = NV) {
  const k1 = new Float64Array(n), k2 = new Float64Array(n), k3 = new Float64Array(n), k4 = new Float64Array(n), tmp = new Float64Array(n);
  return function rk4Step(y, p, h, yNext) {
    derivs(y, p, k1);
    for (let i = 0; i < n; i++) tmp[i] = y[i] + 0.5 * h * k1[i];
    derivs(tmp, p, k2);
    for (let i = 0; i < n; i++) tmp[i] = y[i] + 0.5 * h * k2[i];
    derivs(tmp, p, k3);
    for (let i = 0; i < n; i++) tmp[i] = y[i] + h * k3[i];
    derivs(tmp, p, k4);
    for (let i = 0; i < n; i++) yNext[i] = y[i] + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    return yNext;
  };
}

const _rk4 = makeRK4();
const _ss = new Float64Array(NV), _ss2 = new Float64Array(NV), _e = new Float64Array(2);

/**
 * Steady state of Layer A: integrate from all-searching for up to `T` minutes (≈ 40 patch times)
 * with a convergence stop. Returns { y, e:[e1,e2], G } where G = e1 + e2 is pair intake.
 */
export function steadyState(p, { T = 900, dt = 0.25, tol = 1e-10 } = {}) {
  let y = _ss, yn = _ss2;
  y.set(initialState());
  const n = Math.ceil(T / dt);
  for (let k = 0; k < n; k++) {
    _rk4(y, p, dt, yn);
    let diff = 0;
    for (let i = 0; i < NV; i++) diff = Math.max(diff, Math.abs(yn[i] - y[i]));
    const t = y; y = yn; yn = t;
    if (k > 40 && diff < tol) break;
  }
  const e = intake(y, p, _e);
  return { y: Float64Array.from(y), e: [e[0], e[1]], G: e[0] + e[1] };
}

/** Pair intake G(d) at separation d (all other params from p). */
export function Gstar(p, d) { return steadyState({ ...p, d }).G; }

/** Best silent alternative (AM2): two solo foragers far apart, G = 2 g λ0/(λ0+μ). */
export function Gsilent(p) { return 2 * p.g * p.lambda0 / (p.lambda0 + p.mu); }

/** Solo (silent) baseline: σ = 0, same d. */
export function soloBaseline(p) { return steadyState({ ...p, sigma: 0 }); }

/** Layer B: dd/dt = η·dG/dd − ka (d − dsoc), central difference. */
export function dddt(p, d, hstep = 2) {
  const dG = (Gstar(p, d + hstep) - Gstar(p, Math.max(p.dmin, d - hstep))) / (2 * hstep);
  return p.eta * dG - p.ka * (d - p.dsoc);
}

/**
 * Layer B phase line on a grid of d. Returns { d, f, G, dstar, Gmax, equilibria } where equilibria
 * lists every zero of f with its stability (AM4: a stable contact point ~70 m and an unstable one
 * ~420 m beyond which the pair drifts apart).
 */
export function phaseLine(p, { dMin = 20, dMax = 900, n = 90 } = {}) {
  const ds = [], Gs = [];
  for (let i = 0; i < n; i++) { const d = dMin + (dMax - dMin) * i / (n - 1); ds.push(d); Gs.push(Gstar(p, d)); }
  const f = ds.map((d, i) => {
    const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
    return p.eta * (Gs[i1] - Gs[i0]) / (ds[i1] - ds[i0]) - p.ka * (d - p.dsoc);
  });
  let best = -Infinity;
  for (let i = 0; i < n; i++) if (Gs[i] > best) best = Gs[i];
  const equilibria = [];
  for (let i = 1; i < n - 1; i++) {
    if ((f[i] > 0 && f[i + 1] <= 0) || (f[i] < 0 && f[i + 1] >= 0)) {
      const u = f[i] / (f[i] - f[i + 1]), d = ds[i] + u * (ds[i + 1] - ds[i]);
      equilibria.push({ d, stable: f[i] > 0, G: Gs[i] + u * (Gs[i + 1] - Gs[i]) });
    }
  }
  const stable = equilibria.filter(e => e.stable);
  const dstar = stable.length ? stable.reduce((a, b) => (b.G > a.G ? b : a)).d : null;
  return { d: ds, f, G: Gs, dstar, Gmax: best, equilibria, Gfar: Gsilent(p) };
}

/**
 * Layer C: replicator field in the symmetric (h, β) square. Animal 1's honesty/trust adapt
 * against a partner fixed at the same (h, β). Returns [dh/dt, dβ/dt].
 */
export function layerCField(p, h, beta) {
  const base = { ...p, h1: h, h2: h, beta1: beta, beta2: beta };
  const G1 = q => { const e = steadyState(q).e; return e[0] + (p.k || 0) * e[1]; };   // π_1 = G_1 + k G_2 (AM3)
  const dh = p.rh * h * (1 - h) * (G1({ ...base, h1: 1 }) - G1({ ...base, h1: 0 })) / p.g;
  const db = p.rbeta * beta * (1 - beta) * (G1({ ...base, beta1: 1 }) - G1({ ...base, beta1: 0 })) / p.g;
  return [dh, db];
}

/** Minimum shared-fate weight k for honest–trusting (1,1) to be stable (AM3), by bisection; null if never. */
export function kCrit(p) {
  const ok = k => { const g = layerCGains({ ...p, k }, 0.97, 0.97); return g.honestGain > 0 && g.trustGain > 0; };
  if (ok(0)) return 0; if (!ok(1)) return null;
  let lo = 0, hi = 1; for (let i = 0; i < 16; i++) { const m = (lo + hi) / 2; ok(m) ? hi = m : lo = m; } return hi;
}

/** Payoff differences that drive Layer C (sign tells which corner is stable). */
export function layerCGains(p, h, beta) {
  const base = { ...p, h1: h, h2: h, beta1: beta, beta2: beta };
  const G1 = q => { const e = steadyState(q).e; return e[0] + (p.k || 0) * e[1]; };
  return { honestGain: G1({ ...base, h1: 1 }) - G1({ ...base, h1: 0 }), trustGain: G1({ ...base, beta1: 1 }) - G1({ ...base, beta1: 0 }) };
}

/** Dimensionless groups (MODEL_SPEC §5). */
export function dimensionless(p) {
  return { Lambda: p.lambda0 / p.mu, Sigma: p.sigma / p.mu, Vt: p.v / (p.mu * p.dc), L: p.ls / p.dc, Gamma: p.mu * p.tauG, delta: p.d / p.dc };
}
