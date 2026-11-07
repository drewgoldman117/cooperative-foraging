# Developer notes — Call and Response

Interactive demo of the SCUDEM XI 2026 Problem B model (`../05_our_model/MODEL_SPEC.md`). No build step; plain ES modules.

## Run

```sh
cd 07_web_demo
python3 -m http.server 8080      # ES modules will not load from file://
open http://localhost:8080/
```

Node 24 is used only for tests and syntax checks:

```sh
npm test            # node --test sim/__tests__/*.test.js  (conservation, σ = 0 limit, symmetry, ABM vs ODE, …)
npm run check       # node --check on every module
```

Libraries (PixiJS 8.14, pixi-filters 6.1.5, uPlot 1.6.32, KaTeX 0.16.22) load from jsDelivr through the import map in `index.html`; versions are pinned.

## Structure

```
index.html        page shell: nav, hero, guided, sandbox, map, model, findings, about, presentation stage
styles.css        all CSS (palette tokens mirror render/palette.js)
main.js           wires everything; exposes window.__demo (controller) for console/headless checks
sim/              PURE model, no DOM
  model.js        Layer A ODE (RK4), steady states, Layer B phase line, Layer C replicator field, k_crit
  abm.js          2-D agent-based realisation (trees, states S/G/O/W/J/M, calls, misled, capacity) + ODE companion
  rng.js noise.js seeded PRNG, simplex noise, Poisson-disk sampling
  loop.js         fixed-timestep accumulator with interpolation alpha (sim time in minutes)
  presets.js      scenario presets (plain data)
  __tests__/      node --test suites
render/           PixiJS: scene.js (layers, spring camera, bloom, post-FX), forest.js, monkey.js, effects.js, postfx.js, textures.js, palette.js
charts/           live.js (uPlot), heatmap.js (+ sweep.worker.js, sweep.js), phase.js (Layer B line, Layer C portrait)
ui/               hud.js (sliders/counters), guided.js (7 steps), equations.js (model/findings/about content), present.js, audio.js
docs/screenshots  milestone screenshots
```

Rules: `sim/` never imports from `render/`/`ui/`; the renderer reads state and drains `world.events` once per frame; parameters live on one plain object (`world.params`) that sliders mutate directly.

Time: sim time is in minutes; at speed 1× one sim minute passes per real second. The day/night cycle is `scene.dayLength` sim minutes (default 480).

## URL parameters

`?preset=perfect|silent|vague|noisy|liar|far|small|kin` · `?seed=7` · `?speed=4` · `?mode=sandbox` · `?present=1` · `?only=sandbox` (show one section; used for screenshots) · `?gpu=webgpu`.

## Updating the findings text

`ui/equations.js` → `renderFindings()` writes three cards plus a summary card with `<div class="placeholder" data-finding="1|2|3|summary">`. Replace each placeholder string with the final text (HTML allowed) once `findings.md` is final. The hero hook line is in `index.html` (`#hero-hook`). Model numbers quoted in `ui/guided.js` scores and `charts/phase.js` captions are computed live from the model, not typed in.

## Recording (OBS)

1. Open `http://localhost:8080/?present=1&preset=perfect&seed=7` or press `P` on the page. The stage is a fixed 1920×1080 element scaled to the window; HUD fonts are enlarged, the cursor is hidden and the run is deterministic (seed 7).
2. Keys in presentation mode: `1`–`8` scenario presets, `Space` pause, `[`/`]` speed, `R` restart, `C` camera follow/fit, `H` hide overlays, `Esc` exit.
3. OBS: Window Capture of the browser, 1920×1080 at 60 fps, CRF 18–20. Browser at DPR 1 (or 960×540 window at DPR 2).

## Screenshots (headless)

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader \
  --virtual-time-budget=12000 --hide-scrollbars --window-size=1920,1080 \
  --screenshot=docs/screenshots/sandbox.png "http://localhost:8080/?only=sandbox"
```

Add `--enable-logging=stderr --v=0` to see console messages.

## Deploy

GitHub Pages serves `main` at the repo root; everything is relative paths. Push `main` and the page updates (`.nojekyll` is present).
