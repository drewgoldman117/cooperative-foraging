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
  const p = { ...baseParams, sigma: 0 };
  const ss = steadyState(p);
  const { lambda } = rates(p);
  const Ostar = lambda / (lambda + p.mu);
  for (const o of [0, 5]) {
    assert.ok(Math.abs(ss.y[o + 2]) < 1e-12 && Math.abs(ss.y[o + 3]) < 1e-12 && Math.abs(ss.y[o + 4]) < 1e-12);
    assert.ok(Math.abs(ss.y[o + 1] - Ostar) < 1e-6, `O* ${ss.y[o + 1]} vs ${Ostar}`);
  }
  assert.ok(Math.abs(ss.e[0] - p.g * Ostar) < 1e-6);
  assert.ok(Math.abs(ss.G - soloBaseline(baseParams).G) < 1e-12);
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
  const ss = steadyState({ ...baseParams, h2: 0 });
  assert.ok(ss.e[1] > ss.e[0]);
  assert.ok(ss.y[4] > 0.1, 'honest listener spends time misled');
});

test('d → ∞ limit converges to the solo baseline', () => {
  const far = steadyState({ ...baseParams, d: 1e5 });
  const solo = steadyState({ ...baseParams, d: 1e5, sigma: 0 });
  assert.ok(Math.abs(far.G - solo.G) < 1e-9);
});

test('RK4 convergence: halving dt changes the steady state by < 1e-8', () => {
  const a = steadyState(baseParams, { dt: 0.5 }), b = steadyState(baseParams, { dt: 0.25 });
  assert.ok(Math.abs(a.G - b.G) < 1e-8);
});

test('phase line finds an interior d* when patches are large', () => {
  const pl = phaseLine({ ...baseParams, c: 2 });
  assert.ok(pl.dstar > 20 && pl.dstar < 300, `d* = ${pl.dstar}`);
  assert.ok(pl.Gmax > soloBaseline({ ...baseParams, c: 2, d: pl.dstar }).G);
});

test('Layer C gains are finite numbers', () => {
  const g = layerCGains({ ...baseParams, c: 3, d: 100 }, 0.5, 0.5);
  assert.ok(Number.isFinite(g.honestGain) && Number.isFinite(g.trustGain));
});
