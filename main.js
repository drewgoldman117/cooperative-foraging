// main.js — wires sim + loop + scene + HUD + charts + sections. The only file that knows all of them.
import { createWorld } from './sim/abm.js';
import { baseParams, steadyState } from './sim/model.js';
import { createLoop } from './sim/loop.js';
import { PRESETS, presetById } from './sim/presets.js';
import { createScene } from './render/scene.js';
import { createLiveChart, createHistory } from './charts/live.js';
import { buildSliders, buildCounters, expandParam } from './ui/hud.js';
import { createAudio } from './ui/audio.js';
import { createGuided } from './ui/guided.js';
import { createHeatmap } from './charts/heatmap.js';
import { createPhaseLine, createPhaseC } from './charts/phase.js';
import { renderModelSection, renderFindings, renderAbout } from './ui/equations.js';
import { createPresent } from './ui/present.js';

const $ = id => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
const url = new URLSearchParams(location.search);

// ---- arena element (one canvas, re-parented between sections) -----------------
const arenaEl = $('arena-template').content.firstElementChild.cloneNode(true);
let currentSlot = null;
function moveArena(slot) {
  if (!slot || currentSlot === slot) return;
  slot.appendChild(arenaEl); currentSlot = slot;
  arenaEl.classList.toggle('in-hero', slot.id === 'hero-arena');
}
moveArena($('hero-arena'));

// ---- world + loop -------------------------------------------------------------
let seed = +(url.get('seed') || 7);
const startPreset = presetById[url.get('preset')] || presetById.perfect;
let params = { ...baseParams, ...startPreset.params };
let world = createWorld({ seed, params });
const hist = { intake: createHistory(5), sep: createHistory(3), occ: createHistory(8) };
let ssCache = null;
function refreshSteady() {
  try { ssCache = { comm: steadyState(world.params), solo: steadyState({ ...world.params, sigma: 0 }) }; } catch { ssCache = null; }
}
refreshSteady();

const ctl = {
  get world() { return world; }, get params() { return world.params; },
  listeners: new Set(), frameListeners: new Set(),
  reset(newSeed = seed) {
    seed = newSeed; const p = { ...world.params };
    world = createWorld({ seed, params: p });
    for (const h of Object.values(hist)) h.reset();
    scene && scene.rebuild();
    refreshSteady();
    for (const f of ctl.listeners) f('reset');
  },
  setParams(obj, { restart = false } = {}) {
    world.setParams(obj);
    if (restart) ctl.reset(); else refreshSteady();
    sliders && sliders.sync(world.params);
    for (const f of ctl.listeners) f('params');
  },
  setParam(key, v, o) { ctl.setParams(expandParam(key, v), o); },
  applyPreset(id, { restart = true } = {}) {
    const pr = presetById[id]; if (!pr) return;
    ctl.setParams({ ...baseParams, ...pr.params }, { restart });
    document.querySelectorAll('#presets button').forEach(b => b.classList.toggle('active', b.dataset.id === id));
    $('preset-blurb').textContent = pr.blurb;
    ctl.currentPreset = id;
  },
  get speed() { return loop.speed; }, set speed(v) { loop.speed = v; markSpeed(v); },
  get paused() { return loop.paused; }, set paused(v) { loop.paused = v; $('tr-play').textContent = v ? '▶' : '❚❚'; },
  moveArena, hist, get scene() { return scene; }, get audio() { return audio; }, get ssCache() { return ssCache; },
  show(key, v) { if (scene) scene.show[key] = v; },
};
window.__demo = ctl;

// ---- scene ----------------------------------------------------------------------
const audio = createAudio();
let scene = null;
try { scene = await createScene(arenaEl.querySelector('#arena'), world, { reduced, mobile }); }
catch (e) { console.error(e); }

// ---- transport + sliders + presets + counters -------------------------------------
const SPEEDS = [1, 2, 4, 8, 16, 50];
const speedEl = $('tr-speed');
for (const s of SPEEDS) { const b = document.createElement('button'); b.textContent = s + '×'; b.dataset.s = s; b.onclick = () => { ctl.speed = s; audio.tick(); }; speedEl.appendChild(b); }
function markSpeed(v) { speedEl.querySelectorAll('button').forEach(b => b.classList.toggle('active', +b.dataset.s === v)); }
$('tr-play').onclick = () => { ctl.paused = !ctl.paused; audio.tick(); };
$('tr-reset').onclick = () => { ctl.reset(); audio.tick(); };

const sliders = buildSliders($('controls'), world.params, (key, v) => ctl.setParam(key, v));
const tog = document.createElement('div'); tog.className = 'toggles';
for (const [k, name] of [['rings', 'contact rings'], ['trails', 'trails'], ['beliefs', 'belief markers'], ['calls', 'call ripples'], ['particles', 'ambience']]) {
  const b = document.createElement('button'); b.textContent = name; b.classList.add('active');
  b.onclick = () => { const on = !b.classList.contains('active'); b.classList.toggle('active', on); ctl.show(k, on); };
  tog.appendChild(b);
}
const camBtn = document.createElement('button'); camBtn.textContent = 'camera: follow';
camBtn.onclick = () => { scene.cam.mode = scene.cam.mode === 'follow' ? 'fit' : 'follow'; camBtn.textContent = 'camera: ' + scene.cam.mode; };
tog.appendChild(camBtn);
const seedBtn = document.createElement('button'); seedBtn.textContent = 'new forest';
seedBtn.onclick = () => ctl.reset(seed + 1);
tog.appendChild(seedBtn);
$('controls').appendChild(tog);

const presetsEl = $('presets');
for (const pr of PRESETS) { const b = document.createElement('button'); b.textContent = pr.name; b.dataset.id = pr.id; b.onclick = () => { ctl.applyPreset(pr.id); audio.tick(); }; presetsEl.insertBefore(b, $('preset-blurb')); }
ctl.applyPreset(startPreset.id, { restart: false });
const counters = buildCounters($('counters'));

// ---- charts ----------------------------------------------------------------------
const A = '#FF8A3D', B = '#4FB3F6';
const chIntake = createLiveChart($('ch-intake'), { yLabel: 'food / min', yRange: [0, 1], series: [
  { color: A, width: 2 }, { color: B, width: 2 }, { color: A, dash: [5, 4], width: 1.2 }, { color: B, dash: [5, 4], width: 1.2 }, { color: '#777', dash: [2, 4], width: 1.2 }] });
const chSep = createLiveChart($('ch-sep'), { yLabel: 'm', height: 120, series: [{ color: '#E8F3EC', width: 1.8 }, { color: '#5EEAD4', dash: [5, 4], width: 1.2 }, { color: '#888', dash: [2, 4], width: 1 }] });
const chOcc = createLiveChart($('ch-occ'), { yLabel: 'fraction', yRange: [0, 1], height: 130, series: [
  { color: '#9BB3A4', width: 1.6 }, { color: '#FFD23F', width: 1.6 }, { color: '#8FFFD8', width: 1.6 }, { color: '#FF4FD8', width: 1.6 },
  { color: '#9BB3A4', dash: [4, 4], width: 1 }, { color: '#FFD23F', dash: [4, 4], width: 1 }, { color: '#8FFFD8', dash: [4, 4], width: 1 }, { color: '#FF4FD8', dash: [4, 4], width: 1 }] });

// ---- loop ------------------------------------------------------------------------
let sampleT = -1, chartTick = 0;
const loop = createLoop({
  dt: 0.05, minPerSec: 1,
  update: dt => {
    world.step(dt);
    if (world.t - sampleT >= 0.5) {
      sampleT = world.t;
      const s = world.summary();
      const solo = ssCache ? ssCache.solo.e[0] : null;
      hist.intake.push(world.t, [s.abm[0], s.abm[1], s.odeAvg[0], s.odeAvg[1], solo]);
      hist.sep.push(world.t, [world.separation, world.params.dc, world.params.d]);
      const y = s.odeY;
      hist.occ.push(world.t, [s.frac[0].S, s.frac[0].O, s.frac[0].J, s.frac[0].M, y[0], y[1], y[3], y[4]]);
    }
  },
  render: (alpha, dt) => {
    // audio cues from events (before the scene drains them)
    for (const ev of world.events) {
      if (ev.type === 'call') audio.call(ev.caller, ev.acted ? ev.quality : 'accurate');
      else if (ev.type === 'eat') audio.pop();
      else if (ev.type === 'misled') audio.error();
    }
    if (scene) scene.render(alpha, dt); else world.events.length = 0;
    audio.setSun(scene ? scene.sun : 1);
    hud();
    if (++chartTick % 3 === 0) { chIntake.setData(hist.intake.data()); chSep.setData(hist.sep.data()); chOcc.setData(hist.occ.data()); counters.update(world.monkeys); }
    for (const f of ctl.frameListeners) f(dt);
  },
});
const stateName = { S: 'searching', G: 'walking to find', O: 'feeding (own)', W: 'walking to tip', J: 'feeding (joined)', M: 'misled' };
function hud() {
  const t = world.t;
  $('hud-t').textContent = `${Math.floor(t)} min`;
  $('hud-day').textContent = `day ${Math.floor(t / (scene ? scene.dayLength : 480)) + 1}`;
  $('hud-fa').textContent = world.monkeys[0].food.toFixed(0); $('hud-fb').textContent = world.monkeys[1].food.toFixed(0);
  $('hud-sep').textContent = `${world.separation.toFixed(0)} m`;
  $('hud-state').textContent = `A ${stateName[world.monkeys[0].state]} · B ${stateName[world.monkeys[1].state]}`;
  $('tr-t').textContent = `${loop.fps.toFixed(0)} fps`;
  if (currentSlot && currentSlot.id === 'hero-arena') {
    const m = world.monkeys;
    $('hs-found').textContent = m[0].stats.found + m[1].stats.found; $('hs-calls').textContent = m[0].stats.calls + m[1].stats.calls;
    $('hs-tips').textContent = m[0].stats.tipsFollowed + m[1].stats.tipsFollowed; $('hs-misled').textContent = m[0].stats.misled + m[1].stats.misled;
    $('hs-sep').textContent = `${world.separation.toFixed(0)} m`;
  }
}
ctl.speed = +(url.get('speed') || (mobile ? 2 : 4));
loop.start();

// ---- section activation: move the arena to the section in view -----------------------
const slots = { hero: $('hero-arena'), guided: $('guided-arena'), sandbox: $('sandbox-arena'), map: $('map-arena') };
const visible = new Map();
const io = new IntersectionObserver(entries => {
  for (const e of entries) visible.set(e.target.id, e.intersectionRatio);
  let best = null, bestR = 0.15;
  for (const [id, r] of visible) if (r > bestR) { best = id; bestR = r; }
  if (best && slots[best] && !document.body.classList.contains('present')) moveArena(slots[best]);
  document.querySelectorAll('nav.top .links a').forEach(a => a.classList.toggle('current', a.getAttribute('href') === '#' + best));
}, { threshold: [0, 0.15, 0.3, 0.5, 0.7, 1] });
for (const id of ['hero', 'guided', 'sandbox', 'map']) io.observe($(id));

// ---- sections ------------------------------------------------------------------------
const guided = createGuided(ctl, { chartEl: $('g-chart'), createLiveChart, A, B });
const heat = createHeatmap($('heat'), $('heat-cap'), $('heat-layer'), { onPick: (d, a) => { ctl.setParams({ d, eps1: a, eps2: a, h1: 1, h2: 1 }, { restart: true }); $('map-status').textContent = `forest restarted at d = ${d.toFixed(0)} m, a = ${a.toFixed(2)}`; } });
const phaseLine = createPhaseLine($('phase-line'), $('pl-cap'));
const phaseC = createPhaseC($('phase-c'), $('pc-cap'));
let mapTimer = 0;
function refreshMap() { clearTimeout(mapTimer); mapTimer = setTimeout(() => { heat.update(world.params); phaseLine.update(world.params); phaseC.update(world.params); }, 250); }
ctl.listeners.add(kind => { if (kind === 'params') { heat.setCrosshair(world.params.d, world.params.eps1 * world.params.h1); refreshMap(); } });
refreshMap(); heat.setCrosshair(world.params.d, world.params.eps1 * world.params.h1);
renderModelSection($('model-body')); renderFindings($('findings-cards')); renderAbout($('about-body'));
$('foot-year').textContent = new Date().getFullYear();
const present = createPresent(ctl, { arenaEl, createLiveChart, A, B, slots });

// ---- audio unlock + mute ---------------------------------------------------------------
function setMute(m) { audio.setMuted(m); $('btn-mute').textContent = m ? '🔇 Sound off' : '🔊 Sound on'; }
$('btn-mute').onclick = () => { audio.unlock(); setMute(!audio.muted); };
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => audio.unlock(), { passive: true, once: true });

// ---- keyboard ------------------------------------------------------------------------------
const KEYS = [['Space', 'play / pause'], ['R', 'restart (same forest)'], ['Shift+R', 'new forest'], ['[ / ]', 'slower / faster'], ['1–7', 'guided step (or preset in presentation mode)'], ['P or F', 'presentation mode'], ['M', 'mute'], ['C', 'camera follow / fit'], ['H', 'hide overlays (clean screenshot)'], ['?', 'this help']];
$('help-table').innerHTML = KEYS.map(([k, d]) => `<tr><td><kbd>${k}</kbd></td><td>${d}</td></tr>`).join('');
$('btn-help').onclick = () => $('help').classList.toggle('open');
$('help').onclick = e => { if (e.target.id === 'help') $('help').classList.remove('open'); };
$('btn-present').onclick = () => present.toggle();
addEventListener('keydown', e => {
  if (e.target.matches('input, textarea, select')) return;
  const k = e.key;
  if (k === ' ') { e.preventDefault(); ctl.paused = !ctl.paused; }
  else if (k === 'r') ctl.reset();
  else if (k === 'R') ctl.reset(seed + 1);
  else if (k === '[') ctl.speed = SPEEDS[Math.max(0, SPEEDS.indexOf(loop.speed) - 1)];
  else if (k === ']') ctl.speed = SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(loop.speed) + 1)];
  else if (k === 'p' || k === 'f') present.toggle();
  else if (k === 'm') { audio.unlock(); setMute(!audio.muted); }
  else if (k === 'c') camBtn.click();
  else if (k === 'h') { const on = !scene.show.rings; for (const key of ['rings', 'trails', 'beliefs']) ctl.show(key, on); arenaEl.querySelector('.arena-hud').style.visibility = on ? '' : 'hidden'; arenaEl.querySelector('.arena-legend').style.visibility = on ? '' : 'hidden'; }
  else if (k === '?') $('help').classList.toggle('open');
  else if (k === 'Escape') { $('help').classList.remove('open'); if (document.body.classList.contains('present')) present.toggle(); }
  else if (/^[1-7]$/.test(k)) { if (document.body.classList.contains('present')) { const pr = PRESETS[+k - 1]; if (pr) { ctl.applyPreset(pr.id); present.setScene(pr.name); } } else guided.goto(+k - 1); }
});
if (url.get('present') === '1') present.toggle();
if (url.get('mode') === 'sandbox') $('sandbox').scrollIntoView();
