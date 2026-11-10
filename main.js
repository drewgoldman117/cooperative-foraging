// main.js — v3 demo: four sliders → closed-form food (sim/v3.js) → readout; forest backdrop is illustrative.
import { food, loners, V3 } from './sim/v3.js?v=3';
import { createV3Scene, createV3Fallback } from './render/v3scene.js?v=3';
import katex from 'katex';

const $ = id => document.getElementById(id);
const url = new URLSearchParams(location.search);
const LONERS = loners();

// ---- backdrop -------------------------------------------------------------------------
let scene;
try { if (url.get('gpu') === 'none') throw new Error('forced fallback'); scene = await createV3Scene($('arena'), V3.R); }
catch (e) { console.warn('Using Canvas2D fallback:', e && e.message); $('arena').innerHTML = ''; scene = createV3Fallback($('arena'), V3.R); $('gfx-note').hidden = false; }
let last = performance.now(), running = true;
const DAY = 7;               // seconds of animation for one foraging day (T = 1 day)
let playing = false, tDay = 0, result = null;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (running) {
    if (playing) { tDay = Math.min(1, tDay + dt / DAY); showDay(tDay); if (tDay >= 1) finish(); }
    scene.frame(dt, playing);               // paused: monkeys frozen, ranges still follow the sliders
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
document.addEventListener('visibilitychange', () => { running = !document.hidden; last = performance.now(); });

// ---- sliders → formulas → readout -------------------------------------------------------
const S = { d: $('s-d'), p: $('s-p'), b: $('s-b'), z: $('s-z') };
function read() { return { d: +S.d.value, p: S.p.value / 100, b: S.b.value / 100, z: S.z.value / 100 }; }
const SCALE = 7;   // bar full width = 7 trees/day per monkey
const fmtPct = v => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)} %`;
function labels() {
  const s = read();
  $('v-d').textContent = `${s.d} m`; $('v-p').textContent = `${S.p.value} %`; $('v-b').textContent = `${S.b.value} %`; $('v-z').textContent = `${S.z.value} %`;
  Object.assign(scene.ill.st, { d: s.d, p: s.p, b: s.b, z: s.z });
  scene.setFood?.(1, 1);
}
/** Food eaten by time t (fraction of the day): E_i(t) = F0 (1 − e^{−h_i t}) − c_i t. */
function eatenAt(t) { return [0, 1].map(i => Math.max(0, V3.F0 * (1 - Math.exp(-result.h[i] * t)) - result.c[i] * t)); }
function showDay(t) {
  const hour = 6 + 12 * t, h12 = Math.floor(hour) % 12 || 12;
  $('r-clock').textContent = `${h12} ${hour < 12 ? 'am' : 'pm'}`; $('r-day').style.width = `${100 * t}%`;
  const E = t >= 1 ? result.E : eatenAt(t), tot = E[0] + E[1];
  scene.setFood?.(Math.exp(-result.h[0] * t), Math.exp(-result.h[1] * t));   // F_i(t)/F0 = e^{−h_i t}
  $('r-total').textContent = tot.toFixed(1);
  for (const [i, k] of [[0, 'a'], [1, 'b']]) { $('b-' + k).style.width = `${Math.max(0, Math.min(100, 100 * E[i] / SCALE))}%`; $('n-' + k).textContent = E[i].toFixed(2); }
  $('r-delta').textContent = '';
}
function finish() {
  playing = false; showDay(1);
  const dpct = 100 * (result.total / LONERS - 1);
  $('r-delta').textContent = fmtPct(dpct); $('r-delta').className = 'delta ' + (dpct >= 0 ? 'up' : 'down');
  $('btn-go').textContent = 'Go again'; $('btn-go').classList.remove('running');
}
function go() {
  if (playing) { playing = false; $('btn-go').textContent = 'Go'; $('btn-go').classList.remove('running'); return; }   // pause
  if (!result || tDay >= 1) { result = food(read()); tDay = 0; }
  window.__v3 = { s: read(), r: result };
  for (const k of ['a', 'b']) $('m-' + k).style.left = `${100 * (LONERS / 2) / SCALE}%`;
  $('r-loners').textContent = `${LONERS.toFixed(1)} trees`;
  $('hud').hidden = false; playing = true;
  $('btn-go').textContent = 'Pause'; $('btn-go').classList.add('running');
}
function changed() {                       // any slider move cancels the current day
  labels(); playing = false; result = null; tDay = 0;
  $('hud').hidden = true; $('btn-go').textContent = 'Go'; $('btn-go').classList.remove('running');
}
for (const el of Object.values(S)) el.addEventListener('input', changed);
for (const k of ['d', 'p', 'b', 'z']) if (url.has(k)) S[k].value = url.get(k);
labels();
$('btn-go').onclick = go;
addEventListener('keydown', e => { if (e.key === ' ' && e.target.tagName !== 'INPUT') { e.preventDefault(); go(); } });

// ---- the one info card --------------------------------------------------------------------
const K = t => katex.renderToString(t, { displayMode: true, throwOnError: false });
$('card-body').innerHTML = `
${K('\\frac{dF_i}{dt} = -h_i F_i,\\qquad \\frac{dE_i}{dt} = h_i F_i - c_i,\\qquad F_i(0)=F_0')}
${K('h_i = r_0 + a(1-x) + g\\,b\\,x(1-x)\\,(q_{\\rm partner} - \\kappa\\, q_{\\rm self})')}${K('c_i = x\\,[\\,L(1-q_{\\rm partner})\\,b + C b^2\\,]')}
${K('E_i(T) = F_0\\,(1-e^{-h_i T}) - c_i T,\\qquad q_A = p,\; q_B = p(1-z)')}
<ul>
<li><b>F<sub>i</sub></b> food left in monkey i's range; <b>E<sub>i</sub></b> food it has eaten (i = A, B). Total food = E<sub>A</sub> + E<sub>B</sub>.</li>
<li><b>x</b> overlap of the two home ranges (radius 160 m), set by Distance apart.</li>
<li><b>r₀</b> baseline finding; <b>a(1−x)</b> finds more when ranges don't overlap.</li>
<li><b>x(1−x)</b> chance of contact × chance the news is new.</li>
<li><b>q</b> chance a tip is true; <b>q_partner</b> term: good tips you get; <b>−κ q_self</b> term: half of each tree you share.</li>
<li><b>L(1−q_partner) b x</b> trips wasted on wrong or deceptive tips; <b>C b² x</b> effort of detailed calls.</li>
<li>In the forest, each tree's fruit shows F(t) = F₀e<sup>−ht</sup> for its range; calls happen only in the overlap, more often with more detail, mint if true, yellow if wrong, pink if a lie.</li>
<li><b>p</b> Accuracy, <b>b</b> Detail, <b>z</b> chance B lies (A is always honest).</li>
</ul>
<p class="k">F₀ = 10 trees, r₀ = a = 0.35/day, g = 2.4/day, κ = 0.5, L = 1.5, C = 0.5, T = 1 day. Two loners: 2F₀(1 − e<sup>−0.7</sup>) = ${LONERS.toFixed(2)} trees/day.</p>`;
$('btn-info').onclick = () => { $('card').hidden = false; };
$('card-close').onclick = () => { $('card').hidden = true; };
$('card').addEventListener('click', e => { if (e.target.id === 'card') $('card').hidden = true; });
addEventListener('keydown', e => { if (e.key === 'Escape') $('card').hidden = true; });
