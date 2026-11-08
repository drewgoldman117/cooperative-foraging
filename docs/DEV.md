# DEV — Call and Response (model v3 demo)

- Run: `cd 07_web_demo && python3 -m http.server 8080` → http://localhost:8080/ (modules need http). No build step; PixiJS, pixi-filters and KaTeX pinned on jsDelivr via the import map.
- Model: `sim/v3.js` implements `05_our_model/simple/MODEL_V3.md` exactly (closed form, E_i(T) = F0(1 − e^{−h_i T}) − c_i T). The page recomputes on every slider `input` event.
- Tests: `npm test` (v3 formulas plus the older v1/v2 suites, which are kept in `sim/` but no longer shown).
- Page: `index.html` + `main.js` + `styles.css`; backdrop `render/v3scene.js` (PixiJS forest + monkeys, Canvas2D fallback when there is no GPU; `?gpu=none` forces it). The animation is illustrative only.
- URL presets: `?d=130&p=100&b=100&z=100` set the sliders (p, b, z in %).
- Old guided/sandbox/map code (ui/guided.js, charts/, sim/abm.js etc.) is no longer loaded except sim/abm.js for the seeded forest layout.
- Screenshots: `docs/screenshots/v3_*.png`.
- Deploy: push `main`; GitHub Pages serves the repo root.
