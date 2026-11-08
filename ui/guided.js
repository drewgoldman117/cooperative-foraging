// ui/guided.js — seven guided steps: one mechanism each, predict → run → score. Correct answers are
// computed from the model (ODE steady states + the run itself), never hard-coded.
import { baseParams, steadyState, rates, Gsilent, aCrit } from '../sim/model.js';
import { buildSliders } from './hud.js';

const RUN_T = 240;   // sim minutes per run
const perfect = { sigma: 0.2, q0: 1, eps1: 1, eps2: 1, h1: 1, h2: 1, beta1: 1, beta2: 1, c: 2.5, d: 150 };
const G = p => steadyState({ ...baseParams, ...p }).G, solo = p => steadyState({ ...baseParams, ...p, sigma: 0 }).G;

export const STEPS = [
  { title: 'Two foragers, alone', params: { ...perfect, sigma: 0, d: 200 }, show: { rings: false, beliefs: false, calls: false, trails: true }, slider: 'd',
    rule: 'Each animal searches at speed v and discovers fruit patches at rate λ(d); a patch feeds it for about 1/μ = 15 min, then is exhausted.',
    text: 'No calls yet. Watch the <span class="a">orange</span> and <span class="b">blue</span> monkey find trees on their own. Searching close together is redundant: they sweep the same ground.',
    q: 'Two silent foragers find more trees per hour when they search…', guesses: ['close together (50 m)', 'far apart (400 m)', 'it makes no difference'],
    answer: () => 1, score: (w, p) => `λ(50 m) = ${(rates({ ...baseParams, d: 50 }).lambda * 60).toFixed(2)} vs λ(400 m) = ${(rates({ ...baseParams, d: 400 }).lambda * 60).toFixed(2)} trees/h each. This run (d = ${p.d} m): ${w.monkeys[0].stats.found + w.monkeys[1].stats.found} trees found, ${(w.monkeys[0].food + w.monkeys[1].food).toFixed(0)} food.`, next: '…now let them stay in contact →' },
  { title: 'Stay in contact', params: { ...perfect, d: 300 }, show: { rings: true, beliefs: false, calls: true, trails: true }, slider: 'd',
    rule: 'A feeding finder calls (whinnies) at rate σ. A call at distance d is heard with probability p(d) = exp(−(d/d_c)²), with d_c ≈ 300 m the active space of the call.',
    text: 'The rings are the contact radius d<sub>c</sub>. Ripples fade exactly like p(d). Drag the separation slider and watch how many ripples reach the partner.',
    q: 'At d = d<sub>c</sub> (300 m), what fraction of calls are heard?', guesses: ['about 100 %', 'about 37 %', 'about 5 %'],
    answer: () => 1, score: (w, p) => { const m = w.monkeys, calls = m[0].stats.calls + m[1].stats.calls, heard = m[0].stats.heard + m[1].stats.heard; return `p(d_c) = e⁻¹ = 0.37. This run at d = ${p.d} m: ${heard} of ${calls} calls heard (${calls ? (100 * heard / calls).toFixed(0) : '–'} %); model p(${p.d}) = ${(100 * Math.exp(-((p.d / p.dc) ** 2))).toFixed(0)} %.`; }, next: '…now let a call mean something →' },
  { title: 'Talking', params: { ...perfect, d: 189 }, show: { rings: true, beliefs: true, calls: true, trails: true }, slider: 'sigma',
    rule: 'A searching listener that hears a call acts on it (β = 1): it walks to the patch at speed v and joins the finder. Patches feed both animals (c = 2.5).',
    text: 'The mint packet carries a tip from caller to listener; the solid white ring marks the true patch. The chart compares the running intake with the dashed ODE prediction and the dotted solo baseline.',
    q: 'Over 240 min, will the talking pair eat more than the best silent alternative (two solo foragers far apart)?', guesses: ['yes', 'no', 'about the same'],
    answer: p => G(p) > Gsilent(p) * 1.03 ? 0 : G(p) < Gsilent(p) * 0.97 ? 1 : 2, score: (w, p) => `ODE: talking G* = ${G(p).toFixed(3)} vs far-apart silent ${Gsilent(p).toFixed(3)} (+${(100 * (G(p) / Gsilent(p) - 1)).toFixed(0)} %) and vs silent at the same d ${solo(p).toFixed(3)} food/min. This run: ${((w.monkeys[0].food + w.monkeys[1].food) / w.t).toFixed(3)} food/min (${w.monkeys[0].stats.joined + w.monkeys[1].stats.joined} joins).`, next: '…now make the calls vaguer →' },
  { title: 'How much detail', params: { ...perfect, q0: 0.3 }, show: { rings: true, beliefs: true, calls: true, trails: true }, slider: 'q0',
    rule: 'A true call locates the patch only with probability q₀ (detail). Otherwise the listener walks there, searches locally for τ_g = 10 min, finds nothing and gives up.',
    text: 'Vague packets are wide and fuzzy. The dashed marker is where the listener <em>believes</em> the patch is; the arrow shows its error. A "?" appears when it gives up.',
    q: 'With q₀ = 0.3, is a vague call still better than no call?', guesses: ['yes, any information helps', 'no, silence is better', 'about the same'],
    answer: p => G(p) > solo(p) * 1.03 ? 0 : G(p) < solo(p) * 0.97 ? 1 : 2, score: (w, p) => `ODE at q₀ = ${p.q0}: G* = ${G(p).toFixed(3)} vs silent ${solo(p).toFixed(3)}. Break-even detail at this d: q₀ ≈ ${breakEven(p, 'q0').toFixed(2)}. This run: ${w.monkeys[0].stats.misled + w.monkeys[1].stats.misled} misled.`, next: '…now let them make honest mistakes →' },
  { title: 'Honest mistakes', params: { ...perfect, eps1: 0.5, eps2: 0.5 }, show: { rings: true, beliefs: true, calls: true, trails: true }, slider: 'eps',
    rule: 'Each animal perceives correctly with probability ε. A wrong-but-detailed call sends the partner to the wrong place: the amber jittery packet.',
    text: 'Wrong information is costly because the partner commits travel to it. Drag accuracy down and watch the dashed ODE line sink below the dotted solo baseline.',
    q: 'At ε = 0.5 (right half the time), does talking still beat silence?', guesses: ['yes', 'no', 'about the same'],
    answer: p => G(p) > solo(p) * 1.03 ? 0 : G(p) < solo(p) * 0.97 ? 1 : 2, score: (w, p) => `Pair chain at ε = ${p.eps1}: G* = ${G(p).toFixed(3)} vs silent at the same spacing ${solo(p).toFixed(3)}. A tip is worth following only above the critical accuracy a_crit = ${aCrit(p, p.d).toFixed(2)} at d = ${p.d} m (exact, independent of σ); talking beats silence above ε ≈ ${breakEven(p, 'eps').toFixed(2)}.`, next: '…now let one of them lie →' },
  { title: 'Lying', params: { ...perfect, h2: 0, c: 1.5, d: 189 }, show: { rings: true, beliefs: true, calls: true, trails: true }, slider: 'h2',
    rule: 'The blue monkey is dishonest (h₂ = 0): its calls point away from the patch, so it keeps the tree to itself. Patches are small (c = 1.5), so a joined partner costs the finder (1 − c/2)·g.',
    text: 'Magenta glitching packets are lies. The <span class="a">orange</span> monkey keeps trusting (β₁ = 1) and gets sent on wild-goose chases.',
    q: 'Who gains from lying?', guesses: ['the liar', 'the honest partner', 'both', 'nobody'],
    answer: p => { const s = steadyState({ ...baseParams, ...p }), ref = steadyState({ ...baseParams, ...p, h2: 1 }); const l = s.e[1] > ref.e[1] + 0.005, h = s.e[0] > ref.e[0] + 0.005; return l && h ? 2 : l ? 0 : h ? 1 : 3; },
    score: (w, p) => { const s = steadyState({ ...baseParams, ...p }), ref = steadyState({ ...baseParams, ...p, h2: 1 }); return `ODE: liar ${s.e[1].toFixed(3)} (honest: ${ref.e[1].toFixed(3)}), partner ${s.e[0].toFixed(3)} (honest: ${ref.e[0].toFixed(3)}), pair ${s.G.toFixed(3)} vs ${ref.G.toFixed(3)}. This run: A ${w.monkeys[0].food.toFixed(0)}, B ${w.monkeys[1].food.toFixed(0)} food; A misled ${w.monkeys[0].stats.misled}×.`; }, next: '…now see the whole map →' },
  { title: 'The trade-off', params: { ...perfect, eps1: 0.6, eps2: 0.6, d: 200 }, show: { rings: true, beliefs: true, calls: true, trails: true }, slider: null,
    rule: 'Distance sets how often calls are heard and how far the partner must walk; accuracy sets whether the walk was worth it. A contact equilibrium exists only when A = ε·h·q₀ ≥ 0.57; below that the pair should simply disperse.',
    text: 'Starting from d = 200 m, ε = 0.6: which single change helps more?',
    q: 'Which helps pair intake more?', guesses: ['halving the distance (100 m)', 'raising accuracy to 1.0', 'about the same'],
    answer: p => { const a = G({ ...p, d: p.d / 2 }), b = G({ ...p, eps1: 1, eps2: 1 }); return Math.abs(a - b) < 0.01 ? 2 : a > b ? 0 : 1; },
    score: (w, p) => `ODE: baseline G* = ${G(p).toFixed(3)}; halve distance → ${G({ ...p, d: p.d / 2 }).toFixed(3)}; perfect accuracy → ${G({ ...p, eps1: 1, eps2: 1 }).toFixed(3)}. Explore the full surface in the Map section.`, next: 'Open the map ↓', nextHref: '#map' },
];
function breakEven(p, key) {   // bisection on the ODE: where talking = silent
  const s = solo(p); let lo = 0, hi = 1; const f = v => G(key === 'eps' ? { ...p, eps1: v, eps2: v } : { ...p, [key]: v }) - s;
  if (f(1) < 0) return 1; if (f(0) > 0) return 0;
  for (let k = 0; k < 20; k++) { const m = (lo + hi) / 2; f(m) > 0 ? hi = m : lo = m; } return (lo + hi) / 2;
}

export function createGuided(ctl, { chartEl, createLiveChart, A, B }) {
  const $ = id => document.getElementById(id);
  let cur = 0, guess = null, running = false, done = new Set(), sliderUI = null;
  const chart = createLiveChart(chartEl, { height: 110, yRange: [0, 1], yLabel: 'food/min', series: [{ color: A, width: 2 }, { color: B, width: 2 }, { color: A, dash: [5, 4], width: 1.2 }, { color: B, dash: [5, 4], width: 1.2 }, { color: '#777', dash: [2, 4], width: 1.2 }] });
  const dots = $('g-dots');
  STEPS.forEach((s, i) => { const b = document.createElement('button'); b.title = `${i + 1}. ${s.title}`; b.onclick = () => goto(i); dots.appendChild(b); });

  function render() {
    const s = STEPS[cur];
    dots.querySelectorAll('button').forEach((b, i) => { b.classList.toggle('cur', i === cur); b.classList.toggle('done', done.has(i) && i !== cur); });
    $('g-n').textContent = `${cur + 1} / ${STEPS.length}`; $('g-title').textContent = s.title;
    $('g-rule').textContent = s.rule; $('g-text').innerHTML = s.text; $('g-q').innerHTML = s.q;
    const gs = $('g-guesses'); gs.innerHTML = '';
    s.guesses.forEach((g, i) => { const b = document.createElement('button'); b.textContent = g; b.onclick = () => { guess = i; gs.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b)); $('g-score').textContent = 'Now run it.'; ctl.audio.tick(); }; gs.appendChild(b); });
    $('g-score').textContent = 'Make a guess, then run.'; $('g-score').className = 'score';
    $('g-next').textContent = s.next; $('g-prev').disabled = cur === 0;
    $('g-run').textContent = `▶ Run ${RUN_T} min`; $('g-run').disabled = false;
    const ctlEl = $('g-ctl'); ctlEl.innerHTML = '';
    sliderUI = s.slider ? buildSliders(ctlEl, ctl.params, (k, v) => ctl.setParam(k, v), [s.slider]) : null;
    if (!s.slider) ctlEl.innerHTML = '<p class="muted" style="font-size:13px">The map below is the interactive control for this step.</p>';
    $('g-status').textContent = '';
  }
  function apply() {
    const s = STEPS[cur];
    ctl.setParams({ ...baseParams, ...s.params }, { restart: true });
    for (const k in s.show) ctl.show(k, s.show[k]);
    ctl.paused = false;
  }
  function goto(i) { if (i < 0 || i >= STEPS.length) return; cur = i; guess = null; running = false; render(); apply(); $('guided').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  function run() {
    if (running) return;
    running = true; $('g-run').disabled = true; $('g-run').textContent = 'running…';
    const s = STEPS[cur];
    ctl.reset(); ctl.paused = false; const prevSpeed = ctl.speed; ctl.speed = 16;
    const tick = () => {
      const w = ctl.world; $('g-progress').style.width = `${Math.min(100, 100 * w.t / RUN_T)}%`; $('g-status').textContent = `t = ${w.t.toFixed(0)} / ${RUN_T} min`;
      chart.setData(ctl.hist.intake.data());
      if (w.t >= RUN_T) {
        ctl.frameListeners.delete(tick); ctl.paused = true; ctl.speed = prevSpeed; running = false; done.add(cur);
        const ans = s.answer(w.params), ok = guess === ans;
        $('g-score').innerHTML = `<b>${guess == null ? 'No guess. ' : ok ? 'Correct — ' : 'Not quite — '}</b>${s.guesses[ans]}. ${s.score(w, w.params)}`;
        $('g-score').className = 'score ' + (guess == null ? '' : ok ? 'ok' : 'bad');
        $('g-run').disabled = false; $('g-run').textContent = '↺ Run again'; $('g-status').textContent = 'done · press ▶ to keep watching';
        dots.querySelectorAll('button')[cur].classList.add('done');
        ok ? ctl.audio.pop() : ctl.audio.error();
      }
    };
    ctl.frameListeners.add(tick);
  }
  $('g-run').onclick = run;
  $('g-next').onclick = () => { const s = STEPS[cur]; if (s.nextHref) { location.hash = s.nextHref; } else goto(cur + 1); };
  $('g-prev').onclick = () => goto(cur - 1);
  ctl.listeners.add(kind => { if (kind === 'params' && sliderUI) sliderUI.sync(ctl.params); });
  render();
  // apply the first step's view only when the user enters guided mode (keeps the hero preset otherwise)
  let entered = false;
  const io = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting && !entered) { entered = true; apply(); } }, { threshold: 0.4 });
  io.observe($('guided'));
  return { goto, get step() { return cur; } };
}
