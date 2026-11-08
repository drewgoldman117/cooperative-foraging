// node --test sim/__tests__
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseParams, derivs, initialState, makeRK4, steadyState, soloBaseline, intake, rates, NV, phaseLine, layerCGains } from '../model.js';

const sum = (y, o) => y[o] + y[o + 1] + y[o + 2] + y[o + 3] + y[o + 4];

test('compartments sum to 1 for each animal along a trajectory', () => {
  const rk4 = makeRK4();
  let y = initialState(), yn = new Float64Array(NV);
  const p = { ...baseParams, h2: 0.3, eps1: 0.5, q0: 0.4, d: 120 };
  for (let k = 0; k < 4000; k++) {
    rk4(y, p, 0.25, yn); const t = y; y = yn; yn = t;
    assert.ok(Math.abs(sum(y, 0) - 1) < 1e-9, `animal 1 sum ${sum(y, 0)} at step ${k}`);
    assert.ok(Math.abs(sum(y, 5) - 1) < 1e-9, `animal 2 sum ${sum(y, 5)} at step ${k}`);
    for (let i = 0; i < NV; i++) assert.ok(y[i] >= -1e-12 && y[i] <= 1 + 1e-12, 'probabilities stay in [0,1]');
  }
});

test('derivatives of a probability vector sum to zero (conservation)', () => {
  const out = new Float64Array(NV);
  const y = Float64Array.from([0.3, 0.3, 0.1, 0.2, 0.1, 0.5, 0.2, 0.1, 0.1, 0.1]);
  derivs(y, baseParams, out);
  assert.ok(Math.abs(sum(out, 0)) < 1e-12 && Math.abs(sum(out, 5)) < 1e-12);
});

test('σ = 0 limit: no tips, W = J = M = 0, O* = λ/(λ+μ), e = g O*', () => {
  const p = { ...baseParams, sigma: 0, closure: 'meanfield' };
  const ss = steadyState(p);
  const { lambda } = rates(p);
  const Ostar = lambda / (lambda + p.mu);
  for (const o of [0, 5]) {
    assert.ok(Math.abs(ss.y[o + 2]) < 1e-12 && Math.abs(ss.y[o + 3]) < 1e-12 && Math.abs(ss.y[o + 4]) < 1e-12);
    assert.ok(Math.abs(ss.y[o + 1] - Ostar) < 1e-6, `O* ${ss.y[o + 1]} vs ${Ostar}`);
  }
  assert.ok(Math.abs(ss.e[0] - p.g * Ostar) < 1e-6);
  assert.ok(Math.abs(ss.G - soloBaseline({ ...baseParams, closure: 'meanfield' }).G) < 1e-12);
});

test('symmetric parameters give a symmetric steady state (4-ODE reduction)', () => {
  const ss = steadyState({ ...baseParams, c: 2, q0: 0.6, eps1: 0.7, eps2: 0.7 });
  for (let i = 0; i < 5; i++) assert.ok(Math.abs(ss.y[i] - ss.y[i + 5]) < 1e-10);
  assert.ok(Math.abs(ss.e[0] - ss.e[1]) < 1e-10);
});

test('intake identity: no competition when c ≥ 2, finder loses (1−s2)g when joined', () => {
  const y = Float64Array.from([0.2, 0.4, 0.0, 0.3, 0.1, 0.2, 0.4, 0.0, 0.3, 0.1]);
  const eBig = intake(y, { ...baseParams, c: 3 });
  assert.ok(Math.abs(eBig[0] - (0.4 + 0.3)) < 1e-12);
  const eSmall = intake(y, { ...baseParams, c: 1 });   // s2 = 0.5
  assert.ok(Math.abs(eSmall[0] - (0.4 - 0.5 * 0.3 + 0.5 * 0.3)) < 1e-12);
});

test('deception: liar (h2 = 0) out-eats the honest partner when c < 2', () => {
  const ss = steadyState({ ...baseParams, c: 1.5, h2: 0 });
  assert.ok(ss.e[1] > ss.e[0]);
  assert.ok(ss.y[4] > 0.1, 'honest listener spends time misled');
});

test('d → ∞ limit converges to the solo baseline', () => {
  const far = steadyState({ ...baseParams, d: 1e5 });
  const solo = steadyState({ ...baseParams, d: 1e5, sigma: 0 });
  assert.ok(Math.abs(far.G - solo.G) < 1e-9);
});

test('RK4 convergence: halving dt changes the steady state by < 1e-8', () => {
  const a = steadyState({ ...baseParams, closure: 'meanfield' }, { dt: 0.5 }), b = steadyState({ ...baseParams, closure: 'meanfield' }, { dt: 0.25 });
  assert.ok(Math.abs(a.G - b.G) < 1e-8);
});

test('v1 (meanfield) phase line keeps its bistable shape behind the flag', () => {
  const pl = phaseLine({ ...baseParams, closure: 'meanfield' });
  assert.ok(pl.dstar > 40 && pl.dstar < 120, `d* = ${pl.dstar}`);
  assert.ok(pl.equilibria.find(e => !e.stable), 'unstable point exists');
});

test('Layer C gains are finite numbers', () => {
  const g = layerCGains({ ...baseParams, c: 3, d: 100 }, 0.5, 0.5);
  assert.ok(Number.isFinite(g.honestGain) && Number.isFinite(g.trustGain));
});

// ---- model v2: exact joint pair chain (MODEL_SPEC §10) ----
import { steadyStateJoint, qMatrix, jointIntake, marginals, NJ, JOINT_STATES, aCrit, derivsJoint, initialJoint } from '../model.js';

test('v2: generator rows sum to zero and the stationary law sums to 1 with no negative mass', () => {
  for (const p of [baseParams, { ...baseParams, h2: 0.3, eps1: 0.5, q0: 0.4, d: 120 }, { ...baseParams, d: 600, c: 1 }]) {
    const Q = qMatrix(p);
    for (let i = 0; i < NJ; i++) { let r = 0; for (let j = 0; j < NJ; j++) r += Q[i * NJ + j]; assert.ok(Math.abs(r) < 1e-12); }
    const pi = steadyStateJoint(p);
    assert.ok(Math.abs(pi.reduce((a, b) => a + b, 0) - 1) < 1e-9);
    for (const v of pi) assert.ok(v >= 0 && v <= 1);
    const m = marginals(pi);
    assert.ok(Math.abs(m[0] + m[1] + m[2] + m[3] + m[4] - 1) < 1e-9 && Math.abs(m[5] + m[6] + m[7] + m[8] + m[9] - 1) < 1e-9);
  }
});

test('v2: σ = 0 reduces to the solo formula e_i = g λ/(λ+μ) with no W/J/M mass', () => {
  const p = { ...baseParams, sigma: 0 };
  const pi = steadyStateJoint(p), e = jointIntake(pi, p), { lambda } = rates(p);
  const solo = p.g * lambda / (lambda + p.mu);
  assert.ok(Math.abs(e[0] - solo) < 1e-9 && Math.abs(e[1] - solo) < 1e-9, `${e} vs ${solo}`);
  for (const st of ['WO', 'OW', 'JO', 'OJ', 'SM', 'MS', 'MM', 'OM', 'MO']) assert.ok(pi[JOINT_STATES.indexOf(st)] < 1e-12);
});

test('v2: joined time never exceeds the partner\'s own-feeding time (the v1 artefact is gone)', () => {
  for (const d of [40, 100, 189, 300]) { const m = marginals(steadyStateJoint({ ...baseParams, d })); assert.ok(m[3] <= m[6] + 1e-12, `J1 ${m[3]} > O2 ${m[6]} at d = ${d}`); }
});

test('v2 headline: stable contact d* ≈ 189 m, unstable ≈ 410 m, −0.5 % vs dispersed solos, ≈ +10 % vs silent pair at d*', () => {
  const pl = phaseLine(baseParams, { dMin: 20, dMax: 900, n: 180 });
  const st = pl.equilibria.find(e => e.stable), un = pl.equilibria.find(e => !e.stable);
  assert.ok(st && Math.abs(st.d - 189) < 12, `d* = ${st && st.d}`);
  assert.ok(un && Math.abs(un.d - 410) < 20, `unstable = ${un && un.d}`);
  assert.ok(Math.abs(st.G / pl.Gfar - 1 + 0.005) < 0.01);
  const silent = steadyState({ ...baseParams, d: st.d, sigma: 0 }).G;
  assert.ok(Math.abs(st.G / silent - 1.10) < 0.02, `vs silent ${st.G / silent}`);
  assert.ok(Math.abs(aCrit(baseParams, st.d) - 0.56) < 0.02, `a_crit ${aCrit(baseParams, st.d)}`);
});

test('v2: RK4 on the master equation converges to the linear-solve stationary law', () => {
  const p = baseParams, Q = qMatrix(p), P = initialJoint(), k1 = new Float64Array(NJ), k2 = new Float64Array(NJ), k3 = new Float64Array(NJ), k4 = new Float64Array(NJ), tmp = new Float64Array(NJ);
  const dt = 0.05;
  for (let s = 0; s < 60000; s++) {
    derivsJoint(P, Q, k1); for (let i = 0; i < NJ; i++) tmp[i] = P[i] + 0.5 * dt * k1[i];
    derivsJoint(tmp, Q, k2); for (let i = 0; i < NJ; i++) tmp[i] = P[i] + 0.5 * dt * k2[i];
    derivsJoint(tmp, Q, k3); for (let i = 0; i < NJ; i++) tmp[i] = P[i] + dt * k3[i];
    derivsJoint(tmp, Q, k4); for (let i = 0; i < NJ; i++) P[i] += (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  }
  const pi = steadyStateJoint(p);
  for (let i = 0; i < NJ; i++) assert.ok(Math.abs(P[i] - pi[i]) < 1e-6);
});
