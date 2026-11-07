// sim/presets.js — scenario presets (parameter overrides on top of baseParams). Plain data.
export const PRESETS = [
  { id: 'silent',  key: '1', name: 'Silent',       blurb: 'σ = 0. Two solo foragers; the baseline every other scenario is measured against.', params: { sigma: 0, c: 2, d: 200 } },
  { id: 'perfect', key: '2', name: 'Perfect info', blurb: 'Every call is exact, honest and precisely locatable (q0 = ε = h = 1); patches feed both (c = 2).', params: { sigma: 0.2, q0: 1, eps1: 1, eps2: 1, h1: 1, h2: 1, beta1: 1, beta2: 1, c: 2, d: 150 } },
  { id: 'vague',   key: '3', name: 'Vague calls',  blurb: 'Honest but imprecise: only 30 % of calls carry enough detail to locate the patch (q0 = 0.3).', params: { sigma: 0.2, q0: 0.3, eps1: 1, eps2: 1, h1: 1, h2: 1, c: 2, d: 150 } },
  { id: 'noisy',   key: '4', name: 'Noisy',        blurb: 'Honest mistakes: each animal is right only half the time (ε = 0.5).', params: { sigma: 0.2, q0: 1, eps1: 0.5, eps2: 0.5, h1: 1, h2: 1, c: 2, d: 150 } },
  { id: 'liar',    key: '5', name: 'Liar',         blurb: 'The blue monkey deceives every time (h2 = 0) while the orange one keeps trusting (β1 = 1).', params: { sigma: 0.2, q0: 1, eps1: 1, eps2: 1, h1: 1, h2: 0, beta1: 1, beta2: 1, c: 1.5, d: 150 } },
  { id: 'far',     key: '6', name: 'Far apart',    blurb: 'Perfect information but 500 m apart: calls rarely carry (p(d) ≈ 6 %), coverage is maximal.', params: { sigma: 0.2, q0: 1, eps1: 1, eps2: 1, h1: 1, h2: 1, c: 2, d: 500 } },
];
export const presetById = Object.fromEntries(PRESETS.map(p => [p.id, p]));
