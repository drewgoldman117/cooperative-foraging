// sim/presets.js — scenario presets (parameter overrides on top of baseParams). Plain data.
export const PRESETS = [
  { id: 'silent',  key: '1', name: 'Silent',       blurb: 'σ = 0. Two solo foragers far apart: the best silent alternative (G = 2gλ0/(λ0+μ) = 0.667) that every gain is measured against.', params: { sigma: 0, c: 2.5, d: 500 } },
  { id: 'perfect', key: '2', name: 'Perfect info', blurb: 'Every call is exact, honest and precisely locatable (q0 = ε = h = 1) at the stable contact spacing d* ≈ 189 m.', params: { sigma: 0.2, q0: 1, eps1: 1, eps2: 1, h1: 1, h2: 1, beta1: 1, beta2: 1, c: 2.5, d: 189 } },
  { id: 'vague',   key: '3', name: 'Vague calls',  blurb: 'Honest but imprecise: only 30 % of calls carry enough detail to locate the patch (q0 = 0.3).', params: { sigma: 0.2, q0: 0.3, eps1: 1, eps2: 1, h1: 1, h2: 1, c: 2.5, d: 150 } },
  { id: 'noisy',   key: '4', name: 'Noisy',        blurb: 'Honest mistakes: each animal is right only half the time (ε = 0.5), below the critical accuracy a_crit ≈ 0.56 at d*: listening now costs more than it returns.', params: { sigma: 0.2, q0: 1, eps1: 0.5, eps2: 0.5, h1: 1, h2: 1, c: 2.5, d: 150 } },
  { id: 'liar',    key: '5', name: 'Liar',         blurb: 'The blue monkey deceives every time (h2 = 0) while the orange one keeps trusting (β1 = 1).', params: { sigma: 0.2, q0: 1, eps1: 1, eps2: 1, h1: 1, h2: 0, beta1: 1, beta2: 1, c: 2.5, d: 150 } },
  { id: 'far',     key: '6', name: 'Far apart',    blurb: 'Baseline calls but started 500 m apart, beyond the unstable point (~410 m): with spacing adapting (Layer B on) the pair drifts out of contact.', params: { sigma: 0.2, q0: 0.8, eps1: 0.9, eps2: 0.9, h1: 1, h2: 1, c: 2.5, d: 500 }, adaptD: true },
  { id: 'small',   key: '7', name: 'Small patches', blurb: 'c = 1: a patch feeds one animal, so every joined partner halves the finder\'s intake. Calling no longer pays.', params: { sigma: 0.2, q0: 1, eps1: 1, eps2: 1, h1: 1, h2: 1, c: 1, d: 100 } },
  { id: 'kin',     key: '8', name: 'Kin',          blurb: 'Shared fate κ_rel = 0.5: each animal values half of its partner\'s intake (relatedness), which stabilises the honest–trusting corner of Layer C.', params: { sigma: 0.2, q0: 1, eps1: 1, eps2: 1, h1: 1, h2: 1, c: 2.5, d: 189, kappaRel: 0.5 } },
];
export const presetById = Object.fromEntries(PRESETS.map(p => [p.id, p]));
