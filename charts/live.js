// charts/live.js — uPlot live charts with full-history decimation (never more than ~1200 points).
import uPlot from 'uplot';

const AX = { stroke: '#9BB3A4', grid: { stroke: 'rgba(255,255,255,0.06)' }, ticks: { stroke: 'rgba(255,255,255,0.12)', size: 4 }, font: '11px JetBrains Mono, monospace' };

/** History buffer: push(t, values[]) and decimate by 2 when full. */
export function createHistory(nSeries, cap = 1200) {
  const t = [], v = Array.from({ length: nSeries }, () => []);
  let every = 1, k = 0;
  return {
    t, v,
    push(time, vals) {
      if (k++ % every) return;
      t.push(time); for (let i = 0; i < nSeries; i++) v[i].push(vals[i]);
      if (t.length > cap) {           // decimate: keep every other sample, halve the rate
        for (let j = 0, w = 0; j < t.length; j += 2, w++) { t[w] = t[j]; for (let i = 0; i < nSeries; i++) v[i][w] = v[i][j]; }
        const n = Math.ceil(t.length / 2); t.length = n; for (let i = 0; i < nSeries; i++) v[i].length = n;
        every *= 2;
      }
    },
    reset() { t.length = 0; for (const s of v) s.length = 0; every = 1; k = 0; },
    data() { return [t, ...v]; },
  };
}

export function createLiveChart(el, { series, height = 140, yLabel = '', yRange = null, bands = null }) {
  const opts = {
    width: Math.max(200, el.clientWidth), height,
    cursor: { show: false }, legend: { show: false },
    scales: { x: { time: false }, y: yRange ? { range: yRange } : {} },
    axes: [
      { ...AX, size: 26, label: 'sim time (min)', labelSize: 14, labelFont: '11px Inter, sans-serif' },
      { ...AX, size: 42, label: yLabel, labelSize: 14, labelFont: '11px Inter, sans-serif' },
    ],
    series: [{}, ...series.map(s => ({ stroke: s.color, width: s.width || 1.6, dash: s.dash, fill: s.fill, spanGaps: true, points: { show: false } }))],
    bands,
  };
  const n = series.length;
  const chart = new uPlot(opts, [[0], ...Array.from({ length: n }, () => [null])], el);
  const ro = new ResizeObserver(() => { const w = el.clientWidth; if (w > 50) chart.setSize({ width: w, height }); });
  ro.observe(el);
  return {
    chart,
    setData(d) { chart.setData(d.length > 1 && d[0].length ? d : [[0], ...Array.from({ length: n }, () => [null])]); },
    destroy() { ro.disconnect(); chart.destroy(); },
  };
}
