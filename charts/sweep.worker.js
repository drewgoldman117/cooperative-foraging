// charts/sweep.worker.js — module Web Worker: Layer A steady states for the map and phase widgets.
import { steadyState, phaseLine, layerCField, Gsilent } from '../sim/model.js';

self.onmessage = e => {
  const { id, type, params } = e.data;
  try {
    if (type === 'grid') {
      const { dGrid, aGrid } = e.data;
      const n = dGrid.length * aGrid.length;
      const G = new Float64Array(n), gain = new Float64Array(n), misled = new Float64Array(n), e1 = new Float64Array(n), e2 = new Float64Array(n);
      for (let j = 0; j < aGrid.length; j++) for (let i = 0; i < dGrid.length; i++) {
        const p = { ...params, d: dGrid[i], eps1: aGrid[j], eps2: aGrid[j], h1: 1, h2: 1 };
        const ss = steadyState(p);
        const k = j * dGrid.length + i;
        G[k] = ss.G; gain[k] = ss.G - Gsilent(p); misled[k] = (ss.y[4] + ss.y[9]) / 2; e1[k] = ss.e[0]; e2[k] = ss.e[1];
      }
      self.postMessage({ id, G, gain, misled, e1, e2 });
    } else if (type === 'phaseLine') {
      self.postMessage({ id, ...phaseLine(params, e.data.opts || {}) });
    } else if (type === 'phaseC') {
      const n = e.data.n || 9, h = [], b = [], u = [], v = [];
      for (let i = 0; i < n; i++) { h.push(i / (n - 1)); b.push(i / (n - 1)); }
      for (let j = 0; j < n; j++) { u.push([]); v.push([]); for (let i = 0; i < n; i++) { const [dh, db] = layerCField(params, Math.min(0.999, Math.max(0.001, h[i])), Math.min(0.999, Math.max(0.001, b[j]))); u[j].push(dh); v[j].push(db); } }
      self.postMessage({ id, h, b, u, v });
    }
  } catch (err) { self.postMessage({ id, error: String(err) }); }
};
