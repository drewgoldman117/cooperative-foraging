// sim/loop.js — fixed-timestep accumulator (Fiedler, "Fix Your Timestep") with interpolation alpha.
// Sim time is in minutes; `minPerSec` is how many sim minutes elapse per real second at speed 1×.
export function createLoop({ dt = 0.05, minPerSec = 1, maxFrame = 0.1, maxSteps = 4000, update, render }) {
  let acc = 0, last = null, raf = 0, running = false, speed = 1, fps = 0, fpsAcc = 0, fpsN = 0, paused = false;
  function frame(now) {
    if (!running) return;
    if (last === null) last = now;
    let frameTime = (now - last) / 1000; last = now;
    if (frameTime > maxFrame) frameTime = maxFrame;
    if (!paused) {
      acc += frameTime * speed * minPerSec;
      let steps = 0;
      while (acc >= dt && steps < maxSteps) { update(dt); acc -= dt; steps++; }
      if (steps >= maxSteps) acc = 0;
    }
    render(acc / dt, frameTime);
    fpsAcc += frameTime; fpsN++;
    if (fpsAcc >= 0.5) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
    raf = requestAnimationFrame(frame);
  }
  const api = {
    start() { if (running) return; running = true; last = null; raf = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(raf); },
    get fps() { return fps; },
    get speed() { return speed; }, set speed(v) { speed = v; },
    get paused() { return paused; }, set paused(v) { paused = v; },
    get running() { return running; },
    stepOnce() { update(dt); },
  };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) last = null; });
  return api;
}
