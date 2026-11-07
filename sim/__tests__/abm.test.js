import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, ARENA } from '../abm.js';

function run(params, T = 1200, seed = 3) {
  const w = createWorld({ seed, params });
  for (let k = 0; k < T / 0.05; k++) w.step(0.05);
  return w;
}

test('deterministic: same seed and parameters give the same run', () => {
  const a = run({}, 300), b = run({}, 300);
  assert.deepEqual(a.monkeys.map(m => [m.x, m.y, m.food]), b.monkeys.map(m => [m.x, m.y, m.food]));
});

test('monkeys stay inside the arena', () => {
  const w = run({ d: 900 }, 600);
  for (const m of w.monkeys) assert.ok(m.x >= 0 && m.x <= ARENA.w && m.y >= 0 && m.y <= ARENA.h);
});

test('silent world: no calls, no tips, intake ≈ ODE solo within 25 %', () => {
  const w = run({ sigma: 0 }, 2400);
  const s = w.summary();
  assert.equal(w.monkeys[0].stats.calls + w.monkeys[1].stats.calls, 0);
  assert.equal(w.monkeys[0].stats.tipsFollowed, 0);
  const abm = (s.abm[0] + s.abm[1]) / 2, ode = (s.odeAvg[0] + s.odeAvg[1]) / 2;
  assert.ok(Math.abs(abm - ode) / ode < 0.25, `abm ${abm} ode ${ode}`);
});

test('perfect information pair out-eats the silent pair (c = 2, d = 100 m; mean of 3 seeds)', () => {
  const F = w => w.monkeys[0].food + w.monkeys[1].food;
  let talk = 0, silent = 0, joins = 0;
  for (const seed of [1, 2, 3]) {
    const t = run({ c: 2, q0: 1, eps1: 1, eps2: 1, d: 100 }, 3000, seed);
    talk += F(t); joins += t.monkeys[0].stats.joined + t.monkeys[1].stats.joined;
    silent += F(run({ c: 2, sigma: 0, d: 100 }, 3000, seed));
  }
  assert.ok(talk > silent * 1.1, `talk ${talk} silent ${silent}`);
  assert.ok(joins > 15);
});

test('liar: honest partner is misled and never joins the liar', () => {
  const w = run({ h2: 0, c: 2 }, 2400);
  assert.ok(w.monkeys[0].stats.misled > 5);
  assert.equal(w.monkeys[0].stats.joined, 0);
});

test('time-in-state fractions sum to 1', () => {
  const w = run({}, 600);
  for (const m of w.monkeys) {
    const tot = Object.values(m.timeIn).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(tot - w.t) < 1e-6);
  }
});
