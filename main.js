// main.js — full-screen game shell: one arena, HUD + bottom-bar overlays, modals. Wires sim, loop,
// renderer (PixiJS or Canvas2D fallback), guided mode, sandbox, map/model/about modals.
import { createWorld } from './sim/abm.js';
import { baseParams, steadyState, Gsilent, dddt } from './sim/model.js';
import { createLoop } from './sim/loop.js';
import { PRESETS, presetById } from './sim/presets.js';
import { createScene } from './render/scene.js';
import { createFallbackScene } from './render/fallback.js';
import { createLiveChart, createHistory } from './charts/live.js';
import { buildSliders, buildCounters, expandParam } from './ui/hud.js';
import { createAudio } from './ui/audio.js';
import { createGuided } from './ui/guided.js';
import { createHeatmap } from './charts/heatmap.js';
import { createPhaseLine, createPhaseC } from './charts/phase.js';
import { renderModelSection, renderAbout } from './ui/equations.js';

const $ = id => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
const url = new URLSearchParams(location.search);
const A = '#FF8A3D', B = '#4FB3F6';

// ---- world ----------------------------------------------------------------------
let seed = +(url.get('seed') || 7);
const startPreset = presetById[url.get('preset')] || presetById.perfect;
let world = createWorld({ seed, params: { ...baseParams, ...startPreset.params } });
const hist = { intake: createHistory(5) };
let ssCache = null;
function refreshSteady() { try { ssCache = steadyState(world.params); } catch { ssCache = null; } }
refreshSteady();

const ctl = {
  get world() { return world; }, get params() { return world.params; },
  listeners: new Set(), frameListeners: new Set(), currentPreset: startPreset.id, adaptD: false, etaDemo: 2.5e4,
  reset(newSeed = seed) { seed = newSeed; world = createWorld({ seed, params: { ...world.params } }); hist.intake.reset(); scene && scene.rebuild(); refreshSteady(); for (const f of ctl.listeners) f('reset'); },
  setParams(obj, { restart = false } = {}) { world.setParams(obj); if (restart) ctl.reset(); else refreshSteady(); sliders && sliders.sync(world.params); advSliders && advSliders.sync(world.params); for (const f of ctl.listeners) f('params'); },
  setParam(key, v, o) { ctl.setParams(expandParam(key, v), o); },
  applyPreset(id, { restart = true } = {}) { const pr = presetById[id]; if (!pr) return; ctl.setParams({ ...baseParams, ...pr.params }, { restart }); ctl.setAdapt(!!pr.adaptD); ctl.currentPreset = id; document.querySelectorAll('#presets button').forEach(b => b.classList.toggle('active', b.dataset.id === id)); },
  setAdapt(v) { ctl.adaptD = v; adaptBtn && adaptBtn.classList.toggle('active', v); },
  get speed() { return loop.speed; }, set speed(v) { loop.speed = v; speedEl.querySelectorAll('button').forEach(b => b.classList.toggle('active', +b.dataset.s === v)); },
  get paused() { return loop.paused; }, set paused(v) { loop.paused = v; $('tr-play').textContent = v ? '▶' : '❚❚'; },
  hist, get scene() { return scene; }, get audio() { return audio; }, get ssCache() { return ssCache; },
  show(key, v) { if (scene) scene.show[key] = v; },
  setMode(m) { setMode(m); }, openMenu(pane) { openMenu(pane); },
};
window.__demo = ctl;

// ---- renderer: PixiJS, else Canvas2D fallback -----------------------------------------
const audio = createAudio();
let scene = null;
try { if (url.get('gpu') === 'none') throw new Error('forced fallback (?gpu=none)'); scene = await createScene($('arena'), world, { reduced, mobile }); }
catch (e) { console.warn('WebGL/WebGPU unavailable, using Canvas2D fallback:', e && e.message); $('arena').innerHTML = ''; scene = createFallbackScene($('arena'), world); $('gfx-note').hidden = false; }

// ---- HUD transport ----------------------------------------------------------------------
const SPEEDS = [1, 2, 4, 8, 16, 50];
const speedEl = $('tr-speed');
for (const s of SPEEDS) { const b = document.createElement('button'); b.textContent = s + '×'; b.dataset.s = s; b.onclick = () => { ctl.speed = s; audio.tick(); }; speedEl.appendChild(b); }
$('tr-play').onclick = () => { ctl.paused = !ctl.paused; audio.tick(); };
$('tr-reset').onclick = () => { ctl.reset(); audio.tick(); };

// ---- sandbox controls -------------------------------------------------------------------
const sliders = buildSliders($('controls-main'), world.params, (k, v) => ctl.setParam(k, v), ['d', 'A', 'c', 'h2']);
const advSliders = buildSliders($('controls-adv'), world.params, (k, v) => ctl.setParam(k, v), ['dc', 'q0', 'beta', 'sigma', 'kappaRel']);
const tog = $('toggles');
for (const [k, name] of [['rings', 'rings'], ['trails', 'trails'], ['beliefs', 'markers'], ['calls', 'ripples'], ['particles', 'ambience']]) {
  const b = document.createElement('button'); b.textContent = name; b.classList.add('active'); b.onclick = () => { const on = !b.classList.contains('active'); b.classList.toggle('active', on); ctl.show(k, on); }; tog.appendChild(b);
}
const adaptBtn = document.createElement('button'); adaptBtn.textContent = 'spacing adapts'; adaptBtn.title = 'Layer B: the pair drifts toward the spacing that feeds it best'; adaptBtn.onclick = () => ctl.setAdapt(!ctl.adaptD); tog.appendChild(adaptBtn);
const camBtn = document.createElement('button'); camBtn.textContent = 'camera'; camBtn.title = 'follow the pair / show the whole forest'; camBtn.onclick = () => { scene.cam.mode = scene.cam.mode === 'follow' ? 'fit' : 'follow'; }; tog.appendChild(camBtn);
const seedBtn = document.createElement('button'); seedBtn.textContent = 'new forest'; seedBtn.onclick = () => ctl.reset(seed + 1); tog.appendChild(seedBtn);
const presetsEl = $('presets');
for (const pr of PRESETS) { const b = document.createElement('button'); b.textContent = pr.name; b.dataset.id = pr.id; b.title = pr.blurb; b.onclick = () => { ctl.applyPreset(pr.id); audio.tick(); }; presetsEl.appendChild(b); }
const counters = buildCounters($('counters'));
$('btn-adv').onclick = () => $('advcard').classList.toggle('hidden'); $('adv-close').onclick = () => $('advcard').classList.add('hidden');

// ---- chart ----------------------------------------------------------------------------------
const chIntake = createLiveChart($('ch-intake'), { yLabel: 'food/min', yRange: [0, 1], height: 150, series: [{ color: A, width: 2 }, { color: B, width: 2 }, { color: A, dash: [5, 4], width: 1.2 }, { color: B, dash: [5, 4], width: 1.2 }, { color: '#777', dash: [2, 4], width: 1.2 }] });
$('btn-chart').onclick = () => $('chartpanel').classList.toggle('hidden'); $('chart-close').onclick = () => $('chartpanel').classList.add('hidden');

// ---- loop -----------------------------------------------------------------------------------
let sampleT = -1, tick = 0, adaptT = 0;
const loop = createLoop({
  dt: 0.05, minPerSec: 1,
  update: dt => {
    world.step(dt);
    if (ctl.adaptD) { adaptT += dt; if (adaptT >= 2) { const f = dddt(world.params, world.params.d, 4); const nd = Math.min(900, Math.max(20, world.params.d + ctl.etaDemo * f * adaptT)); adaptT = 0; if (Math.abs(nd - world.params.d) > 0.05) { world.setParam('d', nd); sliders.sync(world.params); } } }
    if (world.t - sampleT >= 0.5) { sampleT = world.t; const s = world.summary(); hist.intake.push(world.t, [s.abm[0], s.abm[1], s.odeAvg[0], s.odeAvg[1], Gsilent(world.params) / 2]); }
  },
  render: (alpha, dt) => {
    for (const ev of world.events) { if (ev.type === 'call') audio.call(ev.caller, ev.acted ? ev.quality : 'accurate'); else if (ev.type === 'eat') audio.pop(); else if (ev.type === 'misled') audio.error(); }
    scene.render(alpha, dt);
    audio.setSun(scene.sun);
    hud();
    if (++tick % 3 === 0) { if (!$('chartpanel').classList.contains('hidden')) chIntake.setData(hist.intake.data()); if (!$('advcard').classList.contains('hidden')) counters.update(world.monkeys); }
    for (const f of ctl.frameListeners) f(dt);
  },
});
function hud() {
  $('hud-t').textContent = `${Math.floor(world.t)} min`; $('hud-day').textContent = `day ${Math.floor(world.t / scene.dayLength) + 1}`;
  $('hud-fa').textContent = world.monkeys[0].food.toFixed(0); $('hud-fb').textContent = world.monkeys[1].food.toFixed(0);
  $('hud-sep').textContent = `${world.separation.toFixed(0)} m`;
}
ctl.speed = +(url.get('speed') || (mobile ? 2 : 4));
loop.start();

// ---- modes: title → play | sandbox ----------------------------------------------------------
const guided = createGuided(ctl, { chartEl: $('g-chart'), createLiveChart });
function setMode(m) {
  document.body.dataset.mode = m;
  $('btn-mode').textContent = m === 'sandbox' ? 'Guided' : 'Sandbox';
  $('infocard').classList.add('hidden'); $('advcard').classList.add('hidden');
  if (m === 'play') { $('chartpanel').classList.add('hidden'); guided.apply(); }
  if (m === 'sandbox') { ctl.applyPreset(ctl.currentPreset); for (const k of ['rings', 'beliefs', 'calls', 'trails']) ctl.show(k, true); ctl.paused = false; }
  history.replaceState(null, '', `#${m}`);
}
function start(m, gesture = false) { $('title').classList.add('out'); if (gesture) audio.unlock(); setMode(m); }
$('btn-start').onclick = () => start('play', true); $('btn-start-sandbox').onclick = () => start('sandbox', true);
$('btn-mode').onclick = () => setMode(document.body.dataset.mode === 'sandbox' ? 'play' : 'sandbox');
// info cards
const SANDBOX_INFO = `<p><b>Spacing d</b> — how far apart the pair tries to stay. Closer: more calls get through, shorter walks. Farther: less overlap while searching.</p><p><b>Call quality A = ε·h·q₀</b> — the chance a heard call is true (ε accuracy, h honesty) and precise enough to find the tree (q₀). This slider sets ε for both; h₂ and q₀ have their own controls.</p><p><b>Patch capacity c</b> — how many monkeys a tree feeds. Below 2 the finder loses food when the partner joins.</p><p><b>Honesty of B</b> — chance blue tells the truth. 0 = always lies.</p><p>Lines: solid = the forest you see; dashed = the model's prediction; dotted = two silent monkeys far apart (0.667 food/min).</p>`;
$('g-info').onclick = () => { $('info-body').innerHTML = guided.info(); $('infocard').classList.toggle('hidden'); };
$('s-info').onclick = () => { $('info-body').innerHTML = SANDBOX_INFO; $('infocard').classList.toggle('hidden'); };
$('info-close').onclick = () => $('infocard').classList.add('hidden');

// ---- menu modal: map / model / about -------------------------------------------------------------
const heat = createHeatmap($('heat'), $('heat-cap'), $('heat-layer'), { onPick: (d, a) => { ctl.setParams({ d, eps1: a, eps2: a, h1: 1, h2: 1, q0: 1 }, { restart: true }); closeMenu(); if (document.body.dataset.mode !== 'sandbox') setMode('sandbox'); } });
const phaseLine = createPhaseLine($('phase-line'), $('pl-cap')), phaseC = createPhaseC($('phase-c'), $('pc-cap'));
let mapTimer = 0, mapDirty = true;
function refreshMap() { mapDirty = false; heat.update(world.params); phaseLine.update(world.params); phaseC.update(world.params); }
ctl.listeners.add(kind => { if (kind === 'params') { heat.setCrosshair(world.params.d, world.params.eps1 * world.params.h1 * world.params.q0); mapDirty = true; if (!$('menu').classList.contains('hidden')) { clearTimeout(mapTimer); mapTimer = setTimeout(refreshMap, 300); } } });
heat.setCrosshair(world.params.d, world.params.eps1 * world.params.h1 * world.params.q0);
function openMenu(pane = 'map') { $('menu').classList.remove('hidden'); document.querySelectorAll('.menutabs button[data-pane]').forEach(b => b.classList.toggle('active', b.dataset.pane === pane)); for (const p of ['map', 'model', 'about']) $('pane-' + p).classList.toggle('hidden', p !== pane); if (pane === 'map' && mapDirty) refreshMap(); }
function closeMenu() { $('menu').classList.add('hidden'); }
$('btn-menu').onclick = () => openMenu('map'); $('menu-close').onclick = closeMenu;
document.querySelectorAll('.menutabs button[data-pane]').forEach(b => b.onclick = () => openMenu(b.dataset.pane));
$('menu').addEventListener('click', e => { if (e.target.id === 'menu') closeMenu(); });
renderModelSection($('model-body')); renderAbout($('about-body'));

// ---- audio, help, keys, presentation -----------------------------------------------------------------
function setMute(m) { audio.setMuted(m); $('btn-mute').textContent = m ? '🔇' : '🔊'; }
$('btn-mute').onclick = () => { audio.unlock(); setMute(!audio.muted); };
const KEYS = [['Space', 'play / pause'], ['R', 'restart'], ['Shift+R', 'new forest'], ['[ / ]', 'slower / faster'], ['1–7', 'guided step · in presentation: preset 1–8'], ['P', 'presentation mode (arena only)'], ['M', 'mute'], ['C', 'camera follow / whole forest'], ['Esc', 'close'], ['?', 'this list']];
$('help-table').innerHTML = KEYS.map(([k, d]) => `<tr><td><kbd>${k}</kbd></td><td>${d}</td></tr>`).join('');
$('btn-help').onclick = () => $('help').classList.toggle('hidden'); $('help-close').onclick = () => $('help').classList.add('hidden');
function togglePresent() { const on = !document.body.classList.contains('present'); document.body.classList.toggle('present', on); if (on) { if (document.body.dataset.mode === 'title') start('sandbox'); ctl.reset(7); ctl.paused = false; if (document.fullscreenEnabled && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); } else if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); }
addEventListener('keydown', e => {
  if (e.target.matches('input, textarea, select')) return;
  const k = e.key, present = document.body.classList.contains('present');
  if (k === ' ') { e.preventDefault(); ctl.paused = !ctl.paused; }
  else if (k === 'r') ctl.reset(); else if (k === 'R') ctl.reset(seed + 1);
  else if (k === '[') ctl.speed = SPEEDS[Math.max(0, SPEEDS.indexOf(loop.speed) - 1)]; else if (k === ']') ctl.speed = SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(loop.speed) + 1)];
  else if (k === 'p' || k === 'f') togglePresent(); else if (k === 'm') { audio.unlock(); setMute(!audio.muted); } else if (k === 'c') camBtn.click();
  else if (k === '?') $('help').classList.toggle('hidden');
  else if (k === 'Escape') { for (const id of ['help', 'menu', 'infocard', 'advcard']) $(id).classList.add('hidden'); if (present) togglePresent(); }
  else if (/^[1-8]$/.test(k)) { if (present || document.body.dataset.mode === 'sandbox') { const pr = PRESETS[+k - 1]; if (pr) ctl.applyPreset(pr.id); } else if (document.body.dataset.mode === 'play') guided.goto(+k - 1); }
});
$('btn-present') && ($('btn-present').onclick = togglePresent);
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => audio.unlock(), { passive: true, once: true });

// ---- start state from URL ------------------------------------------------------------------------------
const h = location.hash.replace('#', '');
if (url.get('present') === '1') { start('sandbox'); togglePresent(); }
else if (h === 'sandbox' || url.get('mode') === 'sandbox') start('sandbox');
else if (h === 'play' || url.get('mode') === 'play') start('play');
if (url.get('step')) { start('play'); guided.goto(+url.get('step') - 1); }
