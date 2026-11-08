// main.js — v3 demo: four sliders → closed-form food (sim/v3.js) → readout; forest backdrop is illustrative.
import { food, loners, V3 } from './sim/v3.js';
import { createV3Scene, createV3Fallback } from './render/v3scene.js';
import katex from 'katex';

const $ = id => document.getElementById(id);
const url = new URLSearchParams(location.search);
const LONERS = loners();

// ---- backdrop -------------------------------------------------------------------------
let scene;
try { if (url.get('gpu') === 'none') throw new Error('forced fallback'); scene = await createV3Scene($('arena'), V3.R); }
catch (e) { console.warn('Using Canvas2D fallback:', e && e.message); $('arena').innerHTML = ''; scene = createV3Fallback($('arena'), V3.R); $('gfx-note').hidden = false; }
let last = performance.now(), running = true;
function frame(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; if (running) scene.frame(dt); requestAnimationFrame(frame); }
requestAnimationFrame(frame);
document.addEventListener('visibilitychange', () => { running = !document.hidden; last = performance.now(); });

// ---- sliders → formulas → readout -------------------------------------------------------
const S = { d: $('s-d'), p: $('s-p'), b: $('s-b'), z: $('s-z') };
function read() { return { d: +S.d.value, p: S.p.value / 100, b: S.b.value / 100, z: S.z.value / 100 }; }
const SCALE = 7;   // bar full width = 7 trees/day per monkey
function update() {
  const s = read(), r = food(s);
  $('v-d').textContent = `${s.d} m`; $('v-p').textContent = `${S.p.value} %`; $('v-b').textContent = `${S.b.value} %`; $('v-z').textContent = `${S.z.value} %`;
  $('r-total').textContent = r.total.toFixed(1);
  const dpct = 100 * (r.total / LONERS - 1);
  $('r-delta').textContent = `${dpct >= 0 ? '+' : '−'}${Math.abs(dpct).toFixed(1)} %`; $('r-delta').className = 'delta ' + (dpct >= 0 ? 'up' : 'down');
  for (const [i, k] of [[0, 'a'], [1, 'b']]) {
    $('b-' + k).style.width = `${Math.max(0, Math.min(100, 100 * r.E[i] / SCALE))}%`;
    $('n-' + k).textContent = r.E[i].toFixed(2);
    $('m-' + k).style.left = `${100 * (LONERS / 2) / SCALE}%`;
  }
  $('r-loners').textContent = LONERS.toFixed(1);
  Object.assign(scene.ill.st, { d: s.d, p: s.p, z: s.z });
  window.__v3 = { s, r };
}
for (const el of Object.values(S)) el.addEventListener('input', update);
for (const k of ['d', 'p', 'b', 'z']) if (url.has(k)) S[k].value = url.get(k);
update();

// ---- the one info card --------------------------------------------------------------------
const K = t => katex.renderToString(t, { displayMode: true, throwOnError: false });
$('card-body').innerHTML = `
${K('\\frac{dF_i}{dt} = -h_i F_i,\\qquad \\frac{dE_i}{dt} = h_i F_i - c_i,\\qquad F_i(0)=F_0')}
${K('h_i = r_0 + a(1-x) + g\\,b\\,x(1-x)\\,(q_j - \\kappa q_i),\\qquad c_i = x\\,[\\,L(1-q_j)\\,b + C b^2\\,]')}
${K('E_i(T) = F_0\\,(1-e^{-h_i T}) - c_i T,\\qquad q_A = p,\; q_B = p(1-z)')}
<ul>
<li><b>F</b> food left in a monkey's range; <b>E</b> food it has eaten.</li>
<li><b>x</b> overlap of the two home ranges (radius 160 m), set by Distance apart.</li>
<li><b>r₀</b> baseline finding; <b>a(1−x)</b> finds more when ranges don't overlap.</li>
<li><b>x(1−x)</b> chance of contact × chance the news is new.</li>
<li><b>q_j g b x(1−x)</b> good tips received; <b>−κ q_i g b x(1−x)</b> food given away by calling.</li>
<li><b>L(1−q_j) b x</b> trips wasted on wrong or deceptive tips; <b>C b² x</b> effort of detailed calls.</li>
<li><b>p</b> Accuracy, <b>b</b> Detail, <b>z</b> chance B lies (A is always honest).</li>
</ul>
<p class="k">F₀ = 10 trees, r₀ = a = 0.35/day, g = 2.4/day, κ = 0.5, L = 1.5, C = 0.5, T = 1 day. Two loners: 2F₀(1−e^{−0.7}) = ${LONERS.toFixed(2)} trees/day.</p>`;
$('btn-info').onclick = () => { $('card').hidden = false; };
$('card-close').onclick = () => { $('card').hidden = true; };
$('card').addEventListener('click', e => { if (e.target.id === 'card') $('card').hidden = true; });
addEventListener('keydown', e => { if (e.key === 'Escape') $('card').hidden = true; });
