// ui/guided.js — seven steps: one sentence of setup, one question, 2–3 guess chips, one Run
// button, one result card (verdict + two bars). Correct answers come from the model, not text.
import { baseParams, steadyState, rates, Gsilent, aCrit } from '../sim/model.js';
import { buildSliders } from './hud.js';

const RUN_T = 240, RUN_SPEED = 16;
const perfect = { sigma: 0.2, q0: 1, eps1: 1, eps2: 1, h1: 1, h2: 1, beta1: 1, beta2: 1, c: 2.5, d: 189 };
const G = p => steadyState({ ...baseParams, ...p }).G, silentSame = p => steadyState({ ...baseParams, ...p, sigma: 0 }).G;
const pct = (a, b) => `${a >= b ? '+' : ''}${(100 * (a / b - 1)).toFixed(0)} %`;
const f3 = x => x.toFixed(3);
const A = '#FF8A3D', B = '#4FB3F6', MINT = '#5EEAD4', GREY = '#9BB3A4';

export const STEPS = [
  { title: 'Alone', params: { ...perfect, sigma: 0, d: 200 }, show: { rings: false, beliefs: false, calls: false, trails: true }, slider: 'd',
    setup: 'No calls yet. Each monkey wanders and finds fruit trees on its own; a tree feeds it for about 15 minutes.',
    q: 'Two silent monkeys find more trees when they search…', guesses: ['close together (50 m)', 'far apart (400 m)', 'no difference'],
    answer: () => 1,
    result: (w, p) => { const l50 = rates({ ...baseParams, d: 50 }).lambda * 60, l400 = rates({ ...baseParams, d: 400 }).lambda * 60;
      return { verdict: `Far apart finds <b>${pct(l400, l50)}</b> more trees. Close together they sweep the same ground.`, bars: [['50 m apart', l50, A, 'trees/h'], ['400 m apart', l400, MINT, 'trees/h']], detail: `This run at ${p.d} m: ${w.monkeys[0].stats.found + w.monkeys[1].stats.found} trees found in ${RUN_T} min.` }; },
    next: 'now let them call →' },
  { title: 'Hearing range', params: { ...perfect, d: 300 }, show: { rings: true, beliefs: false, calls: true, trails: true }, slider: 'd',
    setup: 'A monkey eating at a tree it found calls out. The ring is the hearing range d<sub>c</sub> = 300 m; a call fades like p(d) = e<sup>−(d/d<sub>c</sub>)²</sup>.',
    q: 'At exactly the ring\'s edge (300 m), what share of calls get through?', guesses: ['almost all', 'about a third', 'almost none'],
    answer: () => 1,
    result: (w, p) => { const m = w.monkeys, calls = m[0].stats.calls + m[1].stats.calls, heard = m[0].stats.heard + m[1].stats.heard, model = 100 * Math.exp(-((p.d / p.dc) ** 2));
      return { verdict: `At the ring\'s edge <b>37 %</b> of calls get through (e<sup>−1</sup>). At ${p.d} m the model says ${model.toFixed(0)} %.`, bars: [['model p(d)', model, MINT, '%'], ['this run', calls ? 100 * heard / calls : 0, A, '%']], detail: `${heard} of ${calls} calls were heard in this run.` }; },
    next: 'now let a call mean something →' },
  { title: 'Talking', params: { ...perfect }, show: { rings: true, beliefs: true, calls: true, trails: true }, slider: 'sigma',
    setup: 'A monkey that hears a call walks over and joins the meal. Trees are big enough for two (c = 2.5). The mint packet is the tip; the white ring marks the real tree.',
    q: 'Does the talking pair eat more than two silent monkeys that simply spread out?', guesses: ['yes, clearly', 'about the same', 'no, less'],
    answer: p => { const g = G(p), s = Gsilent(p); return g > s * 1.03 ? 0 : g < s * 0.97 ? 2 : 1; },
    result: (w, p) => { const g = G(p), s = Gsilent(p), same = silentSame(p), run = (w.monkeys[0].food + w.monkeys[1].food) / w.t; const lab = g > s * 1.03 ? 'Yes' : g < s * 0.97 ? 'No, less' : 'About the same';
      return { verdict: `<b>${lab}</b>: ${f3(g)} vs ${f3(s)} food/min (${pct(g, s)}). Against a silent pair at the <em>same</em> spacing, talking gives ${pct(g, same)}.`, bars: [['talking pair', g, MINT, 'food/min'], ['silent, far apart', s, GREY, 'food/min']], detail: `This run: ${f3(run)} food/min, ${w.monkeys[0].stats.joined + w.monkeys[1].stats.joined} shared meals.` }; },
    next: 'now make the calls vaguer →' },
  { title: 'Vague calls', params: { ...perfect, q0: 0.3 }, show: { rings: true, beliefs: true, calls: true, trails: true }, slider: 'q0',
    setup: 'Only a share q₀ of true calls say <em>where</em> the tree is. The rest send the listener to roughly the right area; it searches for 10 minutes, then gives up ("?").',
    q: 'With q₀ = 0.3, is a vague call still better than silence?', guesses: ['yes', 'no', 'about the same'],
    answer: p => { const g = G(p), s = Gsilent(p); return g > s * 1.03 ? 0 : g < s * 0.97 ? 1 : 2; },
    result: (w, p) => { const g = G(p), s = Gsilent(p); return { verdict: g < s * 0.97 ? `<b>No</b>: vague calls cost ${pct(g, s)}. Walking to "somewhere over there" wastes more time than it saves.` : `<b>Yes</b>: even vague calls give ${pct(g, s)}.`, bars: [['vague calls (q₀ = ' + p.q0 + ')', g, MINT, 'food/min'], ['silent, far apart', s, GREY, 'food/min']], detail: `This run: ${w.monkeys[0].stats.misled + w.monkeys[1].stats.misled} wild-goose chases.` }; },
    next: 'now let them make mistakes →' },
  { title: 'Mistakes', params: { ...perfect, eps1: 0.5, eps2: 0.5 }, show: { rings: true, beliefs: true, calls: true, trails: true }, slider: 'eps',
    setup: 'Each monkey is right about the food only with probability ε. A wrong but precise call (amber packet) sends the partner to the wrong place.',
    q: 'At ε = 0.5 (right half the time), does talking still beat silence?', guesses: ['yes', 'no', 'about the same'],
    answer: p => { const g = G(p), s = Gsilent(p); return g > s * 1.03 ? 0 : g < s * 0.97 ? 1 : 2; },
    result: (w, p) => { const g = G(p), s = Gsilent(p), ac = aCrit(p, p.d); return { verdict: `<b>${g < s * 0.97 ? 'No' : g > s * 1.03 ? 'Yes' : 'About the same'}</b>: ${f3(g)} vs ${f3(s)} food/min. A tip is worth following only above a<sub>crit</sub> = <b>${ac.toFixed(2)}</b> at this spacing.`, bars: [['ε = ' + p.eps1, g, MINT, 'food/min'], ['silent, far apart', s, GREY, 'food/min']], detail: `This run: ${w.monkeys[0].stats.misled + w.monkeys[1].stats.misled} times misled, ${w.monkeys[0].stats.joined + w.monkeys[1].stats.joined} shared meals.` }; },
    next: 'now let one of them lie →' },
  { title: 'Lying', params: { ...perfect, h2: 0, c: 1.5 }, show: { rings: true, beliefs: true, calls: true, trails: true }, slider: 'h2',
    setup: 'Blue lies every time (h₂ = 0): its calls point away from the tree so it eats alone. Trees are small (c = 1.5), so sharing costs the finder. Orange keeps trusting.',
    q: 'Who gains from lying?', guesses: ['the liar', 'the honest partner', 'nobody'],
    answer: p => { const s = steadyState({ ...baseParams, ...p }), ref = steadyState({ ...baseParams, ...p, h2: 1 }); const l = s.e[1] > ref.e[1] + 0.005, h = s.e[0] > ref.e[0] + 0.005; return l ? 0 : h ? 1 : 2; },
    result: (w, p) => { const s = steadyState({ ...baseParams, ...p }), ref = steadyState({ ...baseParams, ...p, h2: 1 }); const l = s.e[1] > ref.e[1] + 0.005;
      return { verdict: l ? `<b>The liar</b> eats ${pct(s.e[1], ref.e[1])} more than it would honestly; its partner loses ${pct(s.e[0], ref.e[0])}.` : `<b>Nobody</b> gains: the liar ${pct(s.e[1], ref.e[1])}, the partner ${pct(s.e[0], ref.e[0])}. Lies also starve the liar of future tips.`, bars: [['liar (B)', s.e[1], B, 'food/min'], ['honest partner (A)', s.e[0], A, 'food/min']], detail: `This run: A ${w.monkeys[0].food.toFixed(0)} food and misled ${w.monkeys[0].stats.misled}×, B ${w.monkeys[1].food.toFixed(0)} food.` }; },
    next: 'last: distance or accuracy? →' },
  { title: 'Distance or accuracy', params: { ...perfect, eps1: 0.6, eps2: 0.6, d: 200 }, show: { rings: true, beliefs: true, calls: true, trails: true }, slider: null,
    setup: 'Start from 200 m apart with ε = 0.6. Spacing sets how many calls get through and how far the walk is; accuracy sets whether the walk pays.',
    q: 'Which single change helps the pair more?', guesses: ['halve the distance', 'make calls accurate', 'about the same'],
    answer: p => { const a = G({ ...p, d: p.d / 2 }), b = G({ ...p, eps1: 1, eps2: 1 }); return Math.abs(a - b) < 0.01 ? 2 : a > b ? 0 : 1; },
    result: (w, p) => { const g0 = G(p), a = G({ ...p, d: p.d / 2 }), b = G({ ...p, eps1: 1, eps2: 1 }); return { verdict: `<b>${Math.abs(a - b) < 0.01 ? 'About the same' : a > b ? 'Halving the distance wins' : 'Accurate calls win'}</b>: ${pct(a, g0)} vs ${pct(b, g0)}. Accuracy decides whether calling pays at all; distance decides how much.`, bars: [['halve distance', a, MINT, 'food/min'], ['accurate calls', b, A, 'food/min']], detail: `Baseline ${f3(g0)} food/min. The Map tab shows the whole surface.` }; },
    next: 'open the map →', nextTab: 'map' },
];

export function createGuided(ctl, { chartEl, createLiveChart }) {
  const $ = id => document.getElementById(id);
  let cur = 0, guess = null, running = false, sliderUI = null;
  const done = new Set();
  const chart = createLiveChart(chartEl, { height: 110, yRange: [0, 1], yLabel: 'food/min', series: [{ color: A, width: 2 }, { color: B, width: 2 }, { color: A, dash: [5, 4], width: 1.2 }, { color: B, dash: [5, 4], width: 1.2 }, { color: '#777', dash: [2, 4], width: 1.2 }] });
  const dots = $('g-dots');
  STEPS.forEach((s, i) => { const b = document.createElement('button'); b.title = `${i + 1}. ${s.title}`; b.onclick = () => goto(i); dots.appendChild(b); });
  const runBtn = $('g-run'), result = $('result');
  const fmtT = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

  function render() {
    const s = STEPS[cur];
    dots.querySelectorAll('button').forEach((b, i) => { b.classList.toggle('cur', i === cur); b.classList.toggle('done', done.has(i) && i !== cur); });
    $('g-q').innerHTML = s.q; $('infocard').classList.add('hidden');
    const gs = $('g-guesses'); gs.innerHTML = '';
    s.guesses.forEach((g, i) => { const b = document.createElement('button'); b.textContent = g; b.onclick = () => { guess = i; gs.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b)); runBtn.disabled = false; runBtn.textContent = '▶ Run'; ctl.audio.tick(); }; gs.appendChild(b); });
    runBtn.disabled = true; runBtn.textContent = 'pick a guess';
    result.classList.add('hidden');
    $('g-next').textContent = s.nextTab ? 'Open the map →' : 'Continue →';
    const ctlEl = $('g-ctl'); ctlEl.innerHTML = '';
    sliderUI = s.slider ? buildSliders(ctlEl, ctl.params, (k, v) => ctl.setParam(k, v), [s.slider]) : null;
  }
  function apply() { const s = STEPS[cur]; ctl.setParams({ ...baseParams, ...s.params }, { restart: true }); for (const k in s.show) ctl.show(k, s.show[k]); ctl.paused = false; }
  function goto(i) { if (i < 0 || i >= STEPS.length || running) return; cur = i; guess = null; render(); apply(); }
  function run() {
    if (running || guess == null) return;
    running = true; runBtn.disabled = true;
    const s = STEPS[cur], prog = document.getElementById('run-progress');
    result.classList.add('hidden');
    ctl.reset(); ctl.paused = false; const prevSpeed = ctl.speed; ctl.speed = RUN_SPEED;
    prog.classList.add('on'); prog.firstElementChild.style.width = '0%';
    const tick = () => {
      const w = ctl.world;
      prog.firstElementChild.style.width = `${Math.min(100, 100 * w.t / RUN_T)}%`;
      runBtn.textContent = `Running… ${fmtT(Math.min(w.t, RUN_T))} / ${fmtT(RUN_T)}`;
      if (w.t >= RUN_T) {
        ctl.frameListeners.delete(tick); ctl.paused = true; ctl.speed = prevSpeed; running = false; done.add(cur);
        prog.classList.remove('on');
        const ans = s.answer(w.params), ok = guess === ans, r = s.result(w, w.params);
        $('g-verdict').innerHTML = `<span class="guess ${ok ? 'ok' : 'bad'}">You guessed: ${s.guesses[guess]} · ${ok ? 'correct' : 'not quite'}</span>${r.verdict}`;
        const max = Math.max(...r.bars.map(b => b[1]), 1e-9);
        $('g-bars').innerHTML = r.bars.map(([label, v, col, unit]) => `<div class="row"><span>${label}</span><div class="track"><div class="fill" style="background:${col}"></div></div><span class="val">${v >= 10 ? v.toFixed(0) : v.toFixed(2)} <small>${unit}</small></span></div>`).join('');
        requestAnimationFrame(() => $('g-bars').querySelectorAll('.fill').forEach((el, i) => el.style.width = `${100 * r.bars[i][1] / max}%`));
        $('g-detail').innerHTML = r.detail;
        chart.setData(ctl.hist.intake.data());
        result.classList.remove('hidden');
        runBtn.textContent = '▶ Run'; runBtn.disabled = false;
        dots.querySelectorAll('button')[cur].classList.add('done');
        ok ? ctl.audio.pop() : ctl.audio.error();
      }
    };
    ctl.frameListeners.add(tick);
  }
  runBtn.onclick = run;
  $('g-again').onclick = () => { result.classList.add('hidden'); ctl.paused = false; run(); };
  $('g-next').onclick = () => { const s = STEPS[cur]; result.classList.add('hidden'); if (s.nextTab) { ctl.paused = false; ctl.openMenu('map'); } else goto(cur + 1); };
  result.addEventListener('click', e => { if (e.target === result) { result.classList.add('hidden'); ctl.paused = false; } });
  ctl.listeners.add(kind => { if (kind === 'params' && sliderUI) sliderUI.sync(ctl.params); });
  render();
  return { goto, apply, get step() { return cur; }, info() { const s = STEPS[cur]; return `<p><b>Step ${cur + 1} · ${s.title}</b></p><p>${s.setup}</p><p class="k">Run = ${RUN_T} simulated minutes at ${RUN_SPEED}× speed. The verdict compares the model's long-run rates; "this run" is the forest you watched.</p>`; } };
}
