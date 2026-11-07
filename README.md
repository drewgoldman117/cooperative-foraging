# Call and Response — an interactive differential-equations model of cooperative foraging

Two spider monkeys forage in a Yucatán forest while sharing information that may be vague, wrong, or deliberately false. Built for SCUDEM XI 2026, Problem B (*Group dynamics in foraging*).

**Live:** https://drewgoldman117.github.io/cooperative-foraging/

- Layer A: five-state foraging ODEs per animal (searching, feeding, walking to a tip, joined, misled), integrated with RK4 and shown as a dashed prediction next to a live 2-D agent-based forest that uses the same rules.
- Layer B: spacing dynamics; the phase line is bistable (stable contact at ≈ 70 m, unstable point ≈ 420 m).
- Layer C: honesty × trust replicator dynamics with a shared-fate weight k.
- Guided mode (7 steps, predict → run → score), sandbox with every parameter, a distance × accuracy map computed in the browser, KaTeX equations, parameter table, assumptions and limitations, presentation mode for recording.

No build step: `python3 -m http.server 8080` and open the page. Tests: `npm test`. See `docs/DEV.md`.

Code MIT · text and figures CC-BY 4.0 · art procedural · sound synthesised.
