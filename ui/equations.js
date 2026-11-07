// ui/equations.js — Model / Findings / About sections. KaTeX for every formula; symbols coloured
// by animal (A orange, B blue). Findings are placeholders to be filled from findings.md.
import katex from 'katex';

const A = '#FF8A3D', B = '#4FB3F6', M = '#5EEAD4';
const col = (c, s) => `\\textcolor{${c}}{${s}}`;
function eq(tex, gloss = '') { return `<div class="eq">${katex.renderToString(tex, { displayMode: true, throwOnError: false })}${gloss ? `<div class="gloss">${gloss}</div>` : ''}</div>`; }
const k = tex => katex.renderToString(tex, { throwOnError: false });

export function renderModelSection(root) {
  const i = '{' + col(A, 'i') + '}', j = '{' + col(B, 'j') + '}';
  root.innerHTML = `
<h3>States</h3>
<p>Two animals, <span class="a">A</span> and <span class="b">B</span>, forage in a forest of fruit patches. At any moment each animal <em>${k('i')}</em> is in one of five foraging states with probabilities that sum to one:
${k('S_i')} searching · ${k('O_i')} feeding at a patch it found · ${k('W_i')} walking toward the partner's patch · ${k('J_i')} feeding at the partner's patch (joined) · ${k('M_i')} misled (walking to a false location, then searching locally). Their separation ${k('d')} and the behavioural traits honesty ${k('h_i')} and trust ${k('\\beta_i')} change on slower time scales.</p>

<h3>Layer A — foraging states (minutes)</h3>
${eq(`\\lambda(d) = \\lambda_0\\left(1 - \\tfrac12 e^{-d/\\ell_s}\\right),\\qquad p(d) = e^{-(d/d_c)^2},\\qquad T(d) = \\sigma\\,p(d)`, 'Discovery rate rises with separation (searching close together is redundant); a call at distance d is heard with probability p(d); T is the rate of tips heard per calling partner. <i>Sliders: target separation d, call range d<sub>c</sub>, call rate σ.</i>')}
${eq(`a_${j} = \\varepsilon_${j}\\,h_${j},\\qquad \\omega(d) = \\frac{v}{\\max(d, d_{\\min})},\\qquad \\nu(d) = \\frac{1}{d/v + \\tau_g}`, 'A partner\'s call is true with probability a = accuracy × honesty; ω is the arrival rate when walking to a patch; ν is the recovery rate after a false lead (walk there, give up after τ<sub>g</sub>). <i>Sliders: accuracy ε, honesty h<sub>2</sub>.</i>')}
${eq(`\\begin{aligned}
\\dot S_${i} &= -\\lambda S_${i} - \\beta_${i} T\\, O_${j} S_${i} + \\mu\\,(O_${i} + J_${i} + W_${i}) + \\nu M_${i}\\\\
\\dot O_${i} &= \\lambda S_${i} - \\mu O_${i}\\\\
\\dot W_${i} &= \\beta_${i} T\\, a_${j} q_0\\, O_${j} S_${i} - (\\omega + \\mu) W_${i}\\\\
\\dot J_${i} &= \\omega W_${i} - \\mu J_${i}\\\\
\\dot M_${i} &= \\beta_${i} T\\,(1 - a_${j} q_0)\\, O_${j} S_${i} - \\nu M_${i}
\\end{aligned}`, 'For i = 1, 2 with j the partner. The product O<sub>j</sub>S<sub>i</sub> (partner feeding and calling while I search) makes the system nonlinear; a tip leads to the patch only if it is true <em>and</em> detailed enough (a·q<sub>0</sub>), otherwise it misleads. <i>Sliders: detail q<sub>0</sub>, trust β.</i>')}
${eq(`e_${i} = g\\left[\\,O_${i} - (1 - s_2)\\,J_${j} + s_2\\,J_${i}\\,\\right],\\qquad s_2 = \\min(1, c/2)`, 'Intake: full rate at an own patch, reduced to s<sub>2</sub>g while the partner is joined (the "finder\'s share"), s<sub>2</sub>g while joined to the partner. Long-run intake G<sub>i</sub> = e<sub>i</sub> at the steady state; pair intake G = G<sub>1</sub> + G<sub>2</sub>. Gains from communication are always reported against the best silent alternative, two solo foragers far apart: G<sub>silent</sub> = 2gλ<sub>0</sub>/(λ<sub>0</sub>+μ) = 0.667 g. <i>Slider: patch capacity c.</i>')}

<h3>Layer B — spacing (hours)</h3>
${eq(`\\frac{\\mathrm{d}d}{\\mathrm{d}t} = \\eta\\,\\frac{\\partial G^*}{\\partial d} - k_a\\,(d - d_{soc})`, 'Quasi-steady state: the pair hill-climbs on long-run intake. The equilibria solve ∂G*/∂d = 0; with communication the phase line is bistable: a stable contact point d* ≈ 70 m and an unstable point ≈ 420 m beyond which the pair drifts apart, i.e. fission–fusion as bistability (Map section). k<sub>a</sub> = 0 at baseline; the social-attraction term is an extension that explains why real monkeys sit closer than optimal.')}
<p>In the 2-D animation each searching animal follows a correlated random walk at speed ${k('v')} with a steering term that holds the separation near ${k('d')}; walking animals head straight for their target. This is the agent-based realisation whose running-average intake is drawn solid against the dashed Layer A prediction on every intake chart.</p>

<h3>Layer C — honesty and trust (days)</h3>
${eq(`\\pi_${i} = G_${i} + k\\,G_${j},\\qquad \\dot h_${i} = r_h\\, h_${i}(1 - h_${i})\\,\\frac{\\pi_${i}(h_${i}{=}1) - \\pi_${i}(h_${i}{=}0)}{g},\\qquad \\dot\\beta_${i} = r_\\beta\\, \\beta_${i}(1 - \\beta_${i})\\,\\frac{\\pi_${i}(\\beta_${i}{=}1) - \\pi_${i}(\\beta_${i}{=}0)}{g}`, 'Replicator dynamics toward whichever strategy yields the higher inclusive payoff π<sub>i</sub>, holding every other strategy fixed; k ∈ [0, 1] is a shared-fate / relatedness weight (k = 0: pure self-interest). Corner equilibria: honest–trusting (1, 1) and deceptive–sceptical (0, 0). With k = 0 honesty is weakly unfavourable: a true tip removes the partner from searching for a whole feeding bout (≈ 17 min) whereas a lie costs it only d/v + τ<sub>g</sub> ≈ 12 min, so the liar receives slightly more future tips. The minimum k for honest–trusting to be stable, k<sub>crit</sub>(d, c, q<sub>0</sub>), is a prediction: honest food calling needs kinship, reciprocity or punishment. <i>Slider: shared fate k.</i>')}

<h3>Nondimensionalisation</h3>
${eq(`\\tau = \\mu t,\\quad \\delta = d/d_c,\\quad \\Lambda = \\lambda_0/\\mu,\\quad \\Sigma = \\sigma/\\mu,\\quad \\tilde V = \\frac{v}{\\mu d_c},\\quad L = \\ell_s/d_c,\\quad \\Gamma = \\mu\\tau_g`, 'Baseline: Λ = 0.5 (search efficiency), Σ = 3 (call intensity), Ṽ = 1.5 (call-radii walkable per patch lifetime), L = 0.5, Γ = 0.67; intake in units of g.')}

<h3>Parameters</h3>
<table class="params"><thead><tr><th>Symbol</th><th>Meaning</th><th>Baseline</th><th>Units</th><th>Source / type</th></tr></thead><tbody>
<tr><td class="sym">μ</td><td>patch residence (feed) rate</td><td class="num">1/15</td><td>1/min</td><td>~10 trees/day (Suarez 2006), derived</td></tr>
<tr><td class="sym">λ<sub>0</sub></td><td>solo discovery rate while searching</td><td class="num">1/30</td><td>1/min</td><td>10 trees per 8 h day, half the time searching</td></tr>
<tr><td class="sym">ℓ<sub>s</sub></td><td>coverage-redundancy scale</td><td class="num">150</td><td>m</td><td>core range ~8 ha (assumed)</td></tr>
<tr><td class="sym">σ</td><td>call rate while feeding at an own patch</td><td class="num">1/5</td><td>1/min</td><td>whinny inter-call interval (Ordóñez-Gómez 2019)</td></tr>
<tr><td class="sym">d<sub>c</sub></td><td>call active space</td><td class="num">300</td><td>m</td><td>Ramos-Fernández 2005</td></tr>
<tr><td class="sym">v</td><td>travel speed</td><td class="num">30</td><td>m/min</td><td>~1 km/h while travelling</td></tr>
<tr><td class="sym">τ<sub>g</sub></td><td>give-up time after a false lead</td><td class="num">10</td><td>min</td><td>assumed</td></tr>
<tr><td class="sym">d<sub>min</sub></td><td>minimum separation in the travel-time formula</td><td class="num">10</td><td>m</td><td>assumed</td></tr>
<tr><td class="sym">c</td><td>patch capacity (animal-equivalents)</td><td class="num">2.5</td><td>–</td><td>sweep 0.5–3 (Chapman &amp; Lefebvre 1990; Torney 2011). Below c ≈ 2 calling never beats the silent far-apart pair.</td></tr>
<tr><td class="sym">q<sub>0</sub></td><td>detail / locatability of a call</td><td class="num">0.8</td><td>–</td><td>sweep 0–1</td></tr>
<tr><td class="sym">ε</td><td>perceptual accuracy</td><td class="num">0.9</td><td>–</td><td>sweep 0–1</td></tr>
<tr><td class="sym">h, β</td><td>honesty, trust</td><td class="num">1, 1</td><td>–</td><td>sweep 0–1 / Layer C</td></tr>
<tr><td class="sym">k</td><td>shared-fate / relatedness weight in π<sub>i</sub></td><td class="num">0</td><td>–</td><td>sweep 0–1 (Hamilton; Hauser 1992)</td></tr>
<tr><td class="sym">g</td><td>feeding rate at a patch</td><td class="num">1</td><td>food/min</td><td>normalisation</td></tr>
<tr><td class="sym">η, r<sub>h</sub>, r<sub>β</sub></td><td>adaptation rates of the slow layers</td><td class="num">1</td><td>–</td><td>time-scale only</td></tr>
</tbody></table>

<div class="cols2"><div>
<h3>Assumptions</h3>
<ol class="assume">
<li><b>A1</b> Two animals forage in a forest of fruit patches; a found patch feeds for a mean time 1/μ, then is exhausted.</li>
<li><b>A2</b> Separation d changes slowly compared with the find/feed cycle: a parameter in Layer A, a slow state in Layer B.</li>
<li><b>A3</b> Discovery rate λ(d) rises with d and saturates (random search; range overlap).</li>
<li><b>A4</b> A feeding finder calls at rate σ; a call is heard with p(d) = exp(−(d/d<sub>c</sub>)²), d<sub>c</sub> ≈ 300 m.</li>
<li><b>A5</b> A call carries detail q<sub>0</sub>: the probability a listener acting on a true call can locate the patch.</li>
<li><b>A6</b> Calls are true with probability ε<sub>i</sub>h<sub>i</sub> (honest error × strategic deception); a listener acts with probability β<sub>i</sub>.</li>
<li><b>A7</b> A listener on a true, detailed call walks d/v and feeds; otherwise it walks d/v, searches locally for τ<sub>g</sub>, then resumes searching.</li>
<li><b>A8</b> A patch has capacity c: with two feeders each gets g·min(1, c/2).</li>
<li><b>A9</b> Patches do not deplete faster with two feeders (limitation).</li>
<li><b>A10</b> Honesty and trust adapt by replicator dynamics toward higher long-run intake.</li>
</ol></div><div>
<h3>Numerics</h3>
<p>Layer A is integrated with classical RK4 at a fixed step (0.25 min for steady states, 0.05 min alongside the animation); the steady state is taken after ≤ 900 min with a convergence stop. The map evaluates 625 steady states in a Web Worker. The agent-based forest uses the same rates as discrete events on a seeded PRNG (mulberry32): discoveries, calls, heard/acted/true/locatable draws, exponential residence times. Travel to an own-found patch, which Layer A neglects, is simulated explicitly.</p>
<h3>Limitations</h3>
<ul>
<li>Mean-field: the product O<sub>j</sub>S<sub>i</sub> assumes independence, but with two animals a joined partner cannot also be searching; the ODE over-predicts the benefit of communication relative to the agent-based run (visible on the intake chart).</li>
<li>Patches are memoryless and do not deplete faster when shared (A9); no satiation, no predators, flat 2-D forest.</li>
<li>Deception is a fixed policy per call, not conditioned on patch size or on the partner's behaviour; Layer C adapts slowly rather than learning within a day.</li>
<li>Calls are instantaneous and binary (heard / not heard); real whinnies carry graded information and can be repeated.</li>
</ul></div></div>`;
}

export function renderFindings(root) {
  const items = [
    ['Q1 · Communication level and detail', 'How much do calling (σ) and detail (q<sub>0</sub>) raise pair intake over the silent baseline, and where do the returns saturate?'],
    ['Q2 · Accuracy and deception', 'Below which accuracy a<sub>crit</sub>(d) is listening worse than ignoring? Who gains and who loses when one animal lies, as a function of c and d?'],
    ['Q3 · Distance versus accuracy', 'Where is the ridge d*(ε) on the map, and which parameter moves intake more (local elasticities, global sensitivity)?'],
  ];
  root.innerHTML = items.map(([t, q], i) => `<div class="card"><div class="n">H${i + 1}</div><h3>${t}</h3><p class="muted">${q}</p><div class="placeholder" data-finding="${i + 1}">[to be filled from findings.md]</div></div>`).join('') +
    `<div class="card" style="grid-column:1/-1"><h3>What to consider in cooperative foraging</h3><div class="placeholder" data-finding="summary">[to be filled from findings.md — five bullets for a field biologist]</div></div>`;
}

export function renderAbout(root) {
  root.innerHTML = `
<p><b>Call and Response</b> is the interactive companion to a SCUDEM XI 2026 (Problem B, <em>Group dynamics in foraging</em>) submission by Drew Goldman. The model, this page and the analysis were built in November 2026.</p>
<h3>Watch</h3><p class="placeholder">[10-minute video link — to be added]</p>
<h3>Code</h3><p>Source: <a href="https://github.com/drewgoldman117/cooperative-foraging">github.com/drewgoldman117/cooperative-foraging</a>. No build step: ES modules loaded straight from the repo, with PixiJS v8, pixi-filters, uPlot and KaTeX pinned on jsDelivr. The pure model lives in <code>sim/</code> (no DOM; tested with <code>node --test</code>); the renderer in <code>render/</code> only reads state.</p>
<h3>Cite</h3><pre class="eq mono" style="font-size:12px">@misc{goldman2026callresponse,
  title  = {Call and Response: a coverage--contact--trust model of two cooperating foragers},
  author = {Goldman, Drew},
  year   = {2026},
  note   = {SCUDEM XI 2026, Problem B. https://drewgoldman117.github.io/cooperative-foraging/}
}</pre>
<h3>Credits and licences</h3>
<ul>
<li>Art: fully procedural vector drawing (PixiJS Graphics), © 2026 Drew Goldman, MIT. No raster assets or AI-generated images are shipped.</li>
<li>Sound: synthesised in the browser with the Web Audio API (no samples).</li>
<li>Libraries: <a href="https://pixijs.com">PixiJS</a> and <a href="https://pixijs.io/filters/">pixi-filters</a> (MIT), <a href="https://github.com/leeoniya/uPlot">uPlot</a> (MIT), <a href="https://katex.org">KaTeX</a> (MIT). Fonts: Inter, JetBrains Mono, Space Grotesk (OFL).</li>
<li>Design references: Kenney asset packs (CC0) for shape and shading reference; Nicky Case, Bret Victor, Bartosz Ciechanowski and Complexity Explorables for the explorable structure.</li>
<li>Biology: Ramos-Fernández et al. (spider-monkey spacing and whinny active space), Chapman &amp; Lefebvre 1990 (food calls and patch size), Suarez 2006 (trees per day).</li>
</ul>
<p>Text and figures CC-BY 4.0; code MIT.</p>`;
}
