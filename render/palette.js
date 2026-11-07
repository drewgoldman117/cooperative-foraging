// render/palette.js — single palette source (mirrors styles.css tokens). Art direction §2.
export const PAL = Object.freeze({
  floor: 0x1C2F23, floorMid: 0x223A2B, floorLight: 0x2C4B35, dirt: 0x5B4A36,
  ficus: [0x2F6B3F, 0x4C9A4A, 0x7FC65E],
  ramon: [0x2E6B5A, 0x4F9E82, 0x8ACFA8],
  trunk: 0x4A3728,
  shadow: 0x0A140E,
  agent: [0xFF8A3D, 0x4FB3F6],
  agentDark: [0xC9631F, 0x2B82BF],
  face: 0xF3E2C7,
  fruit: 0xFFD23F, fruitHi: 0xFFF6D6, fruitUnripe: 0xC9D36B,
  truth: 0xF8F6F0,
  deception: 0xFF4FD8,
  inaccurate: 0xFFD36B,
  vague: 0xB8C4FF,
  accurate: 0x8FFFD8,
  mint: 0x5EEAD4,
  text: 0xE8F3EC, muted: 0x9BB3A4,
  firefly: 0xD8FF9A, pollen: 0xFFF1C2,
});
export const AGENT_CSS = ['#FF8A3D', '#4FB3F6'];
export const QUALITY_COLOR = { accurate: PAL.accurate, vague: PAL.vague, inaccurate: PAL.inaccurate, deceptive: PAL.deception };
export const QUALITY_CSS = { accurate: '#8FFFD8', vague: '#B8C4FF', inaccurate: '#FFD36B', deceptive: '#FF4FD8' };

export function hexToRgb(h) { return [(h >> 16) & 255, (h >> 8) & 255, h & 255]; }
export function rgbToHex(r, g, b) { return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b); }
export function lerpColor(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const damp = (rate, dt) => 1 - Math.exp(-rate * dt);
export const wrapAngle = a => a - TAU * Math.floor((a + Math.PI) / TAU);
export const lerpAngle = (a, b, t) => a + wrapAngle(b - a) * t;
export const easeOutCubic = u => 1 - Math.pow(1 - u, 3);
export const easeInOutSine = u => -(Math.cos(Math.PI * u) - 1) / 2;
