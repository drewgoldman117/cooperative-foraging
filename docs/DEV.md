# DEV — Call and Response (SCUDEM XI 2026 B demo)

- Run: `cd 07_web_demo && python3 -m http.server 8080` → http://localhost:8080/ (ES modules need http, not file://). No build step; libs pinned on jsDelivr via the import map in index.html.
- Test: `npm test` (node --test on sim/: conservation, σ=0 limit, symmetry, ABM vs ODE). Syntax: `npm run check`.
- Structure: `sim/` pure model (model.js Layer A/B/C, abm.js 2-D agents, loop.js, presets.js) · `render/` PixiJS scene (forest, monkey, effects, postfx) · `charts/` uPlot + heatmap worker + phase widgets · `ui/` HUD, guided, equations, present, audio · `main.js` wires all.
- Controls: Space play/pause, R restart, Shift+R new forest, [ ] speed, P/F presentation mode (1920×1080, keys 1–8 = presets), C camera, H hide overlays, ? help.
- URL: `?preset=perfect|silent|vague|noisy|liar|far|small|kin&seed=7&speed=4&present=1&only=sandbox`.
- Findings text: edit the `data-finding` placeholders in `ui/equations.js` → `renderFindings()`; hero hook in index.html `#hero-hook`. Model numbers on the page are computed live from `sim/model.js`.
- Recording: open `?present=1&preset=perfect&seed=7`, OBS window capture 1920×1080 @ 60 fps, CRF 18–20; cursor is hidden and the run is deterministic.
- Screenshots: headless Chrome with `--use-angle=swiftshader --enable-unsafe-swiftshader --virtual-time-budget=14000 --window-size=1920,1080 --screenshot=… "http://localhost:8080/?only=guided"` (module workers do not finish under virtual time, so the map renders only in a real browser).
- Deploy: push `main`; GitHub Pages serves the repo root (`.nojekyll` present, all paths relative).
