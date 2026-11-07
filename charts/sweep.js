// charts/sweep.js — promise wrapper around the sweep worker, with a synchronous fallback.
let worker = null, nextId = 1; const pending = new Map();
function getWorker() {
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./sweep.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = e => { const { id } = e.data; const p = pending.get(id); if (!p) return; pending.delete(id); e.data.error ? p.reject(new Error(e.data.error)) : p.resolve(e.data); };
    worker.onerror = err => { console.warn('sweep worker failed, falling back to main thread', err); for (const p of pending.values()) p.reject(err); pending.clear(); worker = null; };
  } catch (e) { worker = null; }
  return worker;
}
export async function sweep(msg) {
  const w = getWorker();
  if (!w) {   // fallback: run the worker body inline
    const m = await import('../sim/model.js');
    if (msg.type === 'phaseLine') return m.phaseLine(msg.params, msg.opts || {});
    throw new Error('worker unavailable');
  }
  const id = nextId++;
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); w.postMessage({ ...msg, id }); });
}
export function viridis(t) {
  t = Math.min(1, Math.max(0, t));
  const c0 = [0.2777, 0.0054, 0.3340], c1 = [0.1050, 1.4042, 1.3845], c2 = [-0.3308, 0.2148, 0.0950], c3 = [-4.6342, -5.7991, -19.3324], c4 = [6.2282, 14.1799, 56.6905], c5 = [4.7763, -13.7451, -65.3530], c6 = [-5.4354, 4.6458, 26.3124];
  return [0, 1, 2].map(i => Math.round(255 * Math.min(1, Math.max(0, c0[i] + t * (c1[i] + t * (c2[i] + t * (c3[i] + t * (c4[i] + t * (c5[i] + t * c6[i])))))))));
}
