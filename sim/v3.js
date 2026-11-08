// sim/v3.js — Model v3 "overlap model" (05_our_model/simple/MODEL_V3.md). Closed form, pure, no DOM.
export const V3 = Object.freeze({ F0: 10, r0: 0.35, a: 0.35, g: 2.4, kappa: 0.5, L: 1.5, C: 0.5, R: 160, T: 1 });

/** Overlapping fraction of one circular home range of radius R when centres are d apart. */
export function overlap(d, R = V3.R) {
  if (d <= 0) return 1;
  if (d >= 2 * R) return 0;
  const lens = 2 * R * R * Math.acos(d / (2 * R)) - (d / 2) * Math.sqrt(4 * R * R - d * d);
  return lens / (Math.PI * R * R);
}

/**
 * E_A(T), E_B(T) for sliders d (m), p accuracy, b detail, z = chance B lies.
 * F_i(t) = F0 e^{-h_i t};  E_i(T) = F0 (1 − e^{−h_i T}) − c_i T.
 */
export function food({ d, p, b, z }, P = V3) {
  const x = overlap(d, P.R);
  const q = [p, p * (1 - z)];                       // q_A, q_B: honest-and-correct rates
  const out = { x, q, h: [0, 0], c: [0, 0], E: [0, 0] };
  for (let i = 0; i < 2; i++) {
    const qi = q[i], qj = q[1 - i];
    const h = P.r0 + P.a * (1 - x) + P.g * b * x * (1 - x) * (qj - P.kappa * qi);
    const c = x * (P.L * (1 - qj) * b + P.C * b * b);
    out.h[i] = h; out.c[i] = c;
    out.E[i] = P.F0 * (1 - Math.exp(-h * P.T)) - c * P.T;
  }
  out.total = out.E[0] + out.E[1];
  return out;
}

/** Two silent monkeys far apart (x = 0): 2 F0 (1 − e^{−(r0+a)T}) = 10.07 trees/day. */
export function loners(P = V3) { return 2 * P.F0 * (1 - Math.exp(-(P.r0 + P.a) * P.T)); }
