// render/scene.js — PixiJS v8 scene: layers, spring camera, forest, monkeys, effects, bloom on the
// lights layer, one post-FX pass. Reads world state; never mutates it.
import { Application, Container } from 'pixi.js';
import { AdvancedBloomFilter } from 'pixi-filters';
import { createForest } from './forest.js';
import { createMonkey } from './monkey.js';
import { createEffects } from './effects.js';
import { PostFilter } from './postfx.js';
import { clamp } from './palette.js';
import { ARENA } from '../sim/abm.js';

function springCritical(o, target, omega, dt) {
  const x = o.v - target, e = Math.exp(-omega * dt), tmp = (o.vel + omega * x) * dt;
  o.v = target + (x + tmp) * e; o.vel = (o.vel - omega * tmp) * e;
}

export async function createScene(host, world, { reduced = false, mobile = false } = {}) {
  const order = new URLSearchParams(location.search).get('gpu') === 'webgpu' ? ['webgpu', 'webgl'] : ['webgl', 'webgpu'];
  let app = null, lastErr = null;
  for (const preference of order) {
    try {
      const c = new Application();
      await c.init({ preference, resizeTo: host, background: '#0e1b14', antialias: true, resolution: Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2), autoDensity: true, autoStart: false, powerPreference: 'high-performance' });
      app = c; break;
    } catch (e) { lastErr = e; }
  }
  if (!app) {
    host.innerHTML = `<div class="gpu-fallback"><strong>GPU rendering is unavailable in this browser.</strong><br>Enable hardware acceleration (Chrome: Settings → System → "Use graphics acceleration") or try another browser.<br><code>${String(lastErr && lastErr.message)}</code></div>`;
    throw lastErr;
  }
  host.appendChild(app.canvas);
  app.canvas.classList.add('arena-canvas');
  app.canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); console.warn('WebGL context lost'); });

  // ---- layers ----------------------------------------------------------------
  const root = new Container();
  const layers = { ground: new Container(), shadows: new Container(), sorted: new Container(), lights: new Container(), overlay: new Container(), fringe: new Container() };
  layers.sorted.sortableChildren = true;
  root.addChild(layers.ground, layers.shadows, layers.sorted, layers.lights, layers.overlay, layers.fringe);
  app.stage.addChild(root);

  let bloom = null, post = null;
  try {
    bloom = new AdvancedBloomFilter({ threshold: 0.3, bloomScale: 1.1, brightness: 1.0, blur: mobile ? 6 : 9, quality: mobile ? 3 : 5 });
    layers.lights.filters = [bloom];
  } catch (e) { console.warn('bloom unavailable', e); }
  try { post = new PostFilter(); app.stage.filters = [post]; } catch (e) { console.warn('post-fx unavailable', e); post = null; }

  // ---- content ---------------------------------------------------------------
  let forest = null, monkeys = [], effects = null;
  function build() {
    for (const k of Object.keys(layers)) layers[k].removeChildren().forEach(c => c.destroy({ children: true }));
    forest = createForest(world, layers, reduced);
    monkeys = [createMonkey(0, layers, 'A'), createMonkey(1, layers, 'B')];
    effects = createEffects(world, layers, monkeys, { reduced });
    for (const m of monkeys) m.st.init = false;
  }
  build();

  // ---- camera ----------------------------------------------------------------
  const cam = { x: { v: ARENA.w / 2, vel: 0 }, y: { v: ARENA.h / 2, vel: 0 }, lz: { v: 0, vel: 0 }, mode: 'follow', zoom: 1 };
  function fitZoom() { return Math.min(app.screen.width / (ARENA.w + 40), app.screen.height / (ARENA.h + 40)); }
  function layout() { cam.lz.v = Math.log(fitZoom()); }
  layout();
  app.renderer.on('resize', layout);

  const pos = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
  let time = 0;
  const api = {
    app, layers, cam, effects: () => effects, forest: () => forest, monkeys: () => monkeys,
    dayLength: 480,          // sim minutes per light cycle
    sun: 1,
    rebuild() { build(); },
    get show() { return effects.show; },
    render(alpha, dt) {
      time += dt;
      // interpolated positions
      for (let i = 0; i < 2; i++) {
        const mk = world.monkeys[i];
        pos[i].x = mk.px + (mk.x - mk.px) * alpha; pos[i].y = mk.py + (mk.y - mk.py) * alpha;
        mk.treeRef = mk.tree >= 0 ? world.trees[mk.tree] : null;
      }
      // day / night
      const phase = (world.t / this.dayLength) % 1;
      const sun = clamp(0.5 + 0.5 * Math.sin((phase + 0.15) * Math.PI * 2) * 1.4, 0, 1);   // starts mid-morning
      this.sun = sun;
      // camera: fit both monkeys with padding; min zoom = whole arena
      const W = app.screen.width, H = app.screen.height;
      const zf = fitZoom();
      let tx = ARENA.w / 2, ty = ARENA.h / 2, tz = zf;
      if (cam.mode === 'follow') {
        const minx = Math.min(pos[0].x, pos[1].x), maxx = Math.max(pos[0].x, pos[1].x), miny = Math.min(pos[0].y, pos[1].y), maxy = Math.max(pos[0].y, pos[1].y);
        const pad = Math.max(170, world.params.dc * 0.55);
        tz = clamp(Math.min(W / (maxx - minx + pad * 2), H / (maxy - miny + pad * 2)), zf, zf * 2.4);
        tx = (minx + maxx) / 2; ty = (miny + maxy) / 2;
        // keep the view inside the (padded) arena
        const hw = W / tz / 2, hh = H / tz / 2;
        tx = clamp(tx, Math.min(hw - 20, ARENA.w / 2), Math.max(ARENA.w - hw + 20, ARENA.w / 2));
        ty = clamp(ty, Math.min(hh - 20, ARENA.h / 2), Math.max(ARENA.h - hh + 20, ARENA.h / 2));
      }
      const sdt = Math.min(dt, 0.05);
      springCritical(cam.x, tx, 2.2, sdt); springCritical(cam.y, ty, 2.2, sdt); springCritical(cam.lz, Math.log(tz), 1.6, sdt);
      const zoom = Math.exp(cam.lz.v); cam.zoom = zoom;
      root.scale.set(zoom); root.position.set(W / 2 - cam.x.v * zoom, H / 2 - cam.y.v * zoom);

      effects.consume(world.events, i => pos[i]); world.events.length = 0;
      forest.update(dt, sun);
      for (let i = 0; i < 2; i++) monkeys[i].update(world.monkeys[i], pos[i].x, pos[i].y, dt, time, zoom);
      effects.update(dt, zoom, sun, i => pos[i], world.separation / world.params.dc);
      if (post) post.set(time, sun);
      app.render();
    },
    screenshot() { return app.canvas.toDataURL('image/png'); },
  };
  return api;
}
