// ui/audio.js — synthesised Web Audio: jungle ambience bed (filtered noise + crickets at night),
// per-agent pitched monkey calls (garbled when the information is bad), fruit pops, UI ticks.
// Nothing plays before the first user gesture. Licence-free by construction.
export function createAudio() {
  let ac = null, master, muteGain, muted = true, amb = null, lastPlayed = {};
  function ensure() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return true; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return false; }
    master = ac.createGain(); muteGain = ac.createGain(); master.gain.value = 0.7; muteGain.gain.value = muted ? 0 : 1;
    master.connect(muteGain).connect(ac.destination);
    document.addEventListener('visibilitychange', () => muteGain.gain.setTargetAtTime(document.hidden || muted ? 0 : 1, ac.currentTime, 0.05));
    startAmbience();
    return true;
  }
  function noiseBuffer(sec, lowpassHz) {
    const n = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(2, n, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let y = 0; const k = Math.exp(-2 * Math.PI * lowpassHz / ac.sampleRate);
      for (let i = 0; i < n; i++) { y = k * y + (1 - k) * (Math.random() * 2 - 1); d[i] = y * 2.5; }
      for (let i = 0; i < 2000; i++) { const f = i / 2000; d[i] *= f; d[n - 1 - i] *= f; } }
    return b;
  }
  function cricketBuffer(sec) {
    const n = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) { const t = i / ac.sampleRate; const env = Math.pow(Math.max(0, Math.sin(t * 2 * Math.PI * 7)), 8) * (Math.sin(t * 2 * Math.PI * 0.7) > 0 ? 1 : 0); d[i] = Math.sin(t * 2 * Math.PI * 4200) * env * 0.12; }
    return b;
  }
  function birdBuffer(sec) {   // sparse day-time chirps
    const n = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
    for (let c = 0; c < 10; c++) { const t0 = Math.random() * (sec - 0.4), f0 = 1800 + Math.random() * 1500; const i0 = Math.floor(t0 * ac.sampleRate), len = Math.floor(0.18 * ac.sampleRate);
      for (let i = 0; i < len; i++) { const u = i / len; d[i0 + i] += Math.sin(2 * Math.PI * (f0 + 600 * Math.sin(u * 9)) * i / ac.sampleRate) * Math.sin(Math.PI * u) * 0.07; } }
    return b;
  }
  function loop(buffer, gain) { const src = ac.createBufferSource(); src.buffer = buffer; src.loop = true; const g = ac.createGain(); g.gain.value = gain; src.connect(g).connect(master); src.start(); return g; }
  function startAmbience() { amb = { wind: loop(noiseBuffer(4, 320), 0.10), crickets: loop(cricketBuffer(6), 0), birds: loop(birdBuffer(12), 0.5) }; }
  function gate(name, ms = 90) { const now = performance.now(); if (lastPlayed[name] && now - lastPlayed[name] < ms) return false; lastPlayed[name] = now; return true; }

  return {
    get muted() { return muted; },
    unlock() { return ensure(); },
    setMuted(m) { muted = m; if (ac) muteGain.gain.setTargetAtTime(m ? 0 : 1, ac.currentTime, 0.03); },
    setSun(sun) { if (!amb) return; amb.crickets.gain.setTargetAtTime(0.5 * (1 - sun), ac.currentTime, 0.5); amb.birds.gain.setTargetAtTime(0.6 * sun, ac.currentTime, 0.5); },
    call(agent, quality = 'accurate') {
      if (!ac || muted || !gate('call')) return;
      const t0 = ac.currentTime, rate = (agent === 0 ? 1.0 : 0.82) * Math.pow(2, (Math.random() - 0.5) * 4 / 12);
      const osc = ac.createOscillator(), mod = ac.createOscillator(), mg = ac.createGain(), g = ac.createGain();
      osc.type = 'triangle'; mod.frequency.value = 28 * rate; mg.gain.value = 110; mod.connect(mg).connect(osc.frequency);
      osc.frequency.setValueAtTime(520 * rate, t0); osc.frequency.exponentialRampToValueAtTime(1150 * rate, t0 + 0.17); osc.frequency.exponentialRampToValueAtTime(640 * rate, t0 + 0.45);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.22, t0 + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);
      osc.connect(g).connect(master); mod.start(t0); osc.start(t0); osc.stop(t0 + 0.55); mod.stop(t0 + 0.55);
      if (quality && quality !== 'accurate') { const nb = ac.createBufferSource(); nb.buffer = noiseBuffer(0.5, quality === 'deceptive' ? 3000 : 1500); const ng = ac.createGain(); ng.gain.value = quality === 'deceptive' ? 0.09 : 0.05; nb.connect(ng).connect(master); nb.start(t0); nb.stop(t0 + 0.4); }
    },
    pop() { if (!ac || muted || !gate('pop', 60)) return; const t0 = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(); const r = 0.9 + Math.random() * 0.3; o.frequency.setValueAtTime(900 * r, t0); o.frequency.exponentialRampToValueAtTime(220 * r, t0 + 0.12); g.gain.setValueAtTime(0.12, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15); o.connect(g).connect(master); o.start(t0); o.stop(t0 + 0.16); },
    tick() { if (!ac || muted || !gate('tick', 40)) return; const t0 = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(); o.type = 'square'; o.frequency.value = 1800; g.gain.setValueAtTime(0.05, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.04); o.connect(g).connect(master); o.start(t0); o.stop(t0 + 0.05); },
    error() { if (!ac || muted || !gate('err', 120)) return; const t0 = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(300, t0); o.frequency.linearRampToValueAtTime(180, t0 + 0.2); g.gain.setValueAtTime(0.08, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.25); o.connect(g).connect(master); o.start(t0); o.stop(t0 + 0.26); },
  };
}
