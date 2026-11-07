// ui/hud.js — HTML controls bound to world parameters. No framework.
export const SLIDERS = [
  { key: 'd',     name: 'Target separation', sym: 'd',   min: 20, max: 800, step: 5, unit: 'm',   help: 'How far apart the pair tries to stay (Layer B treats this as a slow state).' },
  { key: 'dc',    name: 'Call range',        sym: 'd_c', min: 50, max: 600, step: 10, unit: 'm',  help: 'Whinny active space: a call at distance d is heard with p = exp(−(d/d_c)²).' },
  { key: 'q0',    name: 'Detail',            sym: 'q_0', min: 0, max: 1, step: 0.05, unit: '',    help: 'Probability a true call carries enough detail to locate the patch.' },
  { key: 'eps',   name: 'Accuracy',          sym: 'ε',   min: 0, max: 1, step: 0.05, unit: '',    help: 'Perceptual accuracy of both animals (honest mistakes).' },
  { key: 'h2',    name: 'Honesty of B',      sym: 'h_2', min: 0, max: 1, step: 0.05, unit: '',    help: 'Probability the blue monkey tells the truth. 0 = always deceives.' },
  { key: 'beta',  name: 'Trust',             sym: 'β',   min: 0, max: 1, step: 0.05, unit: '',    help: 'Probability a listener acts on a call it hears (both animals).' },
  { key: 'c',     name: 'Patch capacity',    sym: 'c',   min: 0.5, max: 3, step: 0.1, unit: '',   help: 'Animal-equivalents a patch feeds. Below 2 the finder loses (1−c/2)·g while joined.' },
  { key: 'k',     name: 'Shared fate',       sym: 'k',   min: 0, max: 1, step: 0.05, unit: '',    help: 'Relatedness weight in the Layer C payoff π_i = G_i + k·G_j. 0 = pure self-interest.' },
  { key: 'sigma', name: 'Call rate',         sym: 'σ',   min: 0, max: 0.6, step: 0.02, unit: '/min', help: 'Calls per minute while feeding at an own-found patch. 0 = silent.' },
];
const fmt = (v, s) => s.step >= 1 ? `${Math.round(v)} ${s.unit}`.trim() : `${v.toFixed(2)} ${s.unit}`.trim();

/** Compound keys: eps → eps1+eps2, beta → beta1+beta2. */
export function readParam(p, key) { return key === 'eps' ? p.eps1 : key === 'beta' ? p.beta1 : p[key]; }
export function expandParam(key, v) { return key === 'eps' ? { eps1: v, eps2: v } : key === 'beta' ? { beta1: v, beta2: v } : { [key]: v }; }

export function buildSliders(root, params, onChange, keys = null) {
  const list = keys ? SLIDERS.filter(s => keys.includes(s.key)) : SLIDERS;
  const inputs = {};
  for (const s of list) {
    const wrap = document.createElement('div'); wrap.className = 'slider';
    wrap.innerHTML = `<label><span>${s.name}<span class="sym">${s.sym}</span></span><span class="val"></span></label><input type="range" min="${s.min}" max="${s.max}" step="${s.step}" aria-label="${s.name}"><div class="help">${s.help}</div>`;
    const inp = wrap.querySelector('input'), val = wrap.querySelector('.val');
    inp.value = readParam(params, s.key); val.textContent = fmt(+inp.value, s);
    inp.addEventListener('input', () => { val.textContent = fmt(+inp.value, s); onChange(s.key, +inp.value); });
    inp.addEventListener('dblclick', () => { inp.value = s.key === 'eps' ? 0.9 : s.key === 'beta' ? 1 : s.key === 'h2' ? 1 : ''; inp.dispatchEvent(new Event('input')); });
    root.appendChild(wrap);
    inputs[s.key] = { inp, val, s };
  }
  return {
    inputs,
    /** Reflect external parameter changes (presets, map clicks). */
    sync(params) { for (const k in inputs) { const { inp, val, s } = inputs[k]; inp.value = readParam(params, k); val.textContent = fmt(+inp.value, s); } },
  };
}

export function buildCounters(root) {
  const defs = [['found', 'Trees found'], ['calls', 'Calls'], ['tipsFollowed', 'Tips followed'], ['joined', 'Joined'], ['misled', 'Times misled']];
  const cells = {};
  for (const [k, name] of defs) {
    const c = document.createElement('div'); c.className = 'c';
    c.innerHTML = `<div class="k">${name}</div><div class="v"><span class="a" data-i="0">0</span><span class="b" data-i="1">0</span></div>`;
    root.appendChild(c); cells[k] = [c.querySelector('[data-i="0"]'), c.querySelector('[data-i="1"]')];
  }
  return { update(monkeys) { for (const k in cells) for (let i = 0; i < 2; i++) cells[k][i].textContent = monkeys[i].stats[k]; } };
}
