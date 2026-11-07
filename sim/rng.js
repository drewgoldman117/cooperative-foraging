// sim/rng.js — seeded PRNG (mulberry32) + helpers. No Math.random anywhere in sim/.
export function mulberry32(seed) {
  let a = seed >>> 0;
  const rng = function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.seed = seed;
  return rng;
}
/** Exponential variate with rate `rate` (mean 1/rate). */
export function expRand(rng, rate) { return -Math.log(1 - rng()) / rate; }
/** Gaussian (Box–Muller). */
export function gaussRand(rng) {
  const u = 1 - rng(), v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
