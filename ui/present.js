// ui/present.js — presentation mode: fixed 1920×1080 stage scaled to the viewport, enlarged HUD,
// hidden cursor, deterministic seed, number keys 1–6 switch scenario presets (main.js).
export function createPresent(ctl, { arenaEl, createLiveChart, A, B, slots }) {
  const $ = id => document.getElementById(id);
  const stage = $('present-stage');
  let on = false, chart = null, prevSlot = null;
  function fit() { const s = Math.min(innerWidth / 1920, innerHeight / 1080); stage.style.transform = `scale(${s})`; stage.style.width = '1920px'; stage.style.height = '1080px'; }
  addEventListener('resize', () => { if (on) fit(); });
  const tick = () => { if (chart) chart.setData(ctl.hist.intake.data()); };
  return {
    get on() { return on; },
    setScene(name) { $('present-scene').textContent = name; },
    toggle() {
      on = !on;
      document.body.classList.toggle('present', on);
      if (on) {
        prevSlot = arenaEl.parentElement;
        fit(); ctl.moveArena($('present-arena'));
        if (!chart) chart = createLiveChart($('present-chart'), { height: 150, yRange: [0, 1], yLabel: 'food/min', series: [{ color: A, width: 2.5 }, { color: B, width: 2.5 }, { color: A, dash: [6, 5], width: 1.5 }, { color: B, dash: [6, 5], width: 1.5 }, { color: '#777', dash: [2, 5], width: 1.5 }] });
        ctl.frameListeners.add(tick);
        ctl.reset(7); ctl.paused = false; ctl.speed = 4;
        this.setScene(ctl.currentPreset ? (document.querySelector(`#presets button[data-id="${ctl.currentPreset}"]`) || {}).textContent || '' : '');
        if (document.fullscreenEnabled && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
      } else {
        ctl.frameListeners.delete(tick);
        ctl.moveArena(prevSlot && prevSlot.id !== 'present-arena' ? prevSlot : slots.sandbox);
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      }
    },
  };
}
