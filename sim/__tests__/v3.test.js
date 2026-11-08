import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overlap, food, loners, V3 } from '../v3.js';

test('overlap: x(0) = 1, x(320) = 0, monotone decreasing', () => {
  assert.equal(overlap(0), 1); assert.equal(overlap(320), 0); assert.equal(overlap(400), 0);
  let prev = 1; for (let d = 5; d <= 320; d += 5) { const x = overlap(d); assert.ok(x <= prev + 1e-12 && x >= 0); prev = x; }
});

test('silent far baseline: two loners eat 10.07 trees/day, and d = 320 reproduces it for any p, b, z', () => {
  assert.ok(Math.abs(loners() - 10.07) < 0.005, String(loners()));
  for (const s of [{ p: 1, b: 1, z: 0 }, { p: 0.2, b: 0.7, z: 1 }]) assert.ok(Math.abs(food({ d: 320, ...s }).total - loners()) < 1e-12);
});

test('closed form matches F0(1 − e^{−hT}) − cT and the ODE dF = −hF, dE = hF − c', () => {
  const r = food({ d: 130, p: 0.8, b: 0.6, z: 0.3 });
  for (let i = 0; i < 2; i++) {
    let F = V3.F0, E = 0; const n = 100000, dt = V3.T / n;
    for (let k = 0; k < n; k++) { const dF = -r.h[i] * F; E += (r.h[i] * F - r.c[i]) * dt; F += dF * dt; }
    assert.ok(Math.abs(E - r.E[i]) < 1e-3, `${E} vs ${r.E[i]}`);
  }
});

test('symmetric honest case gives E_A = E_B', () => {
  for (const d of [0, 80, 130, 250]) { const r = food({ d, p: 0.9, b: 0.7, z: 0 }); assert.ok(Math.abs(r.E[0] - r.E[1]) < 1e-12); }
});

test('deception z = 1: E_B > E_A and the pair total falls', () => {
  const honest = food({ d: 130, p: 1, b: 1, z: 0 }), liar = food({ d: 130, p: 1, b: 1, z: 1 });
  assert.ok(liar.E[1] > liar.E[0]);
  assert.ok(liar.total < honest.total);
});
