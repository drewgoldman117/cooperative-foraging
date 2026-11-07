// render/monkey.js — hand-authored vector spider monkey (top-down), fully procedural animation:
// idle breathing, distance-driven walk cycle, feeding reach, call pose with open mouth,
// squash-and-stretch on turns, prehensile tail that lags heading and curls at rest.
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { PAL, TAU, clamp, damp, lerpAngle, wrapAngle } from './palette.js';
import { softBlob } from './textures.js';

export function createMonkey(i, layers, name) {
  const col = PAL.agent[i], dark = PAL.agentDark[i];
  const node = new Container();                  // world position; y-sorted
  const rig = new Container();                   // rotated by heading, squashed on turns
  node.addChild(rig);

  const shadow = new Sprite(softBlob(128, 0.3));
  shadow.anchor.set(0.5); shadow.tint = PAL.shadow; shadow.alpha = 0.38; shadow.width = 46; shadow.height = 22;

  const tail = new Graphics(), limbs = new Graphics();
  const body = new Graphics();
  body.ellipse(0, 0, 14, 9).fill(col).stroke({ width: 1.6, color: 0x0a140e, alpha: 0.5 });
  body.ellipse(-1, -2.5, 8.5, 4).fill({ color: 0xffffff, alpha: 0.16 });     // back highlight
  body.ellipse(-4, 2.5, 7, 3).fill({ color: dark, alpha: 0.35 });            // flank shade
  const head = new Container(); head.position.set(13, 0);
  const headG = new Graphics();
  headG.circle(-2, -6.5, 2.6).fill(dark); headG.circle(-2, 6.5, 2.6).fill(dark);   // ears
  headG.circle(0, 0, 7).fill(col).stroke({ width: 1.6, color: 0x0a140e, alpha: 0.5 });
  headG.ellipse(2.2, 0, 4.4, 3.9).fill(PAL.face);                            // pale face
  headG.circle(3.4, -1.9, 1.15).fill(0x1a1410); headG.circle(3.4, 1.9, 1.15).fill(0x1a1410);
  headG.circle(3.0, -2.3, 0.4).fill(0xffffff); headG.circle(3.0, 1.5, 0.4).fill(0xffffff);
  const mouth = new Graphics().ellipse(5.6, 0, 1.3, 1.7).fill(0x3a1a12);
  mouth.scale.set(0.001);
  head.addChild(headG, mouth);
  rig.addChild(tail, limbs, body, head);

  // glow halo while calling (bloomed)
  const halo = new Sprite(softBlob(128, 0.1));
  halo.anchor.set(0.5); halo.tint = col; halo.blendMode = 'add'; halo.width = halo.height = 70; halo.alpha = 0;

  // label + emote glyph live in the overlay (crisp, screen-constant)
  const label = new Text({ text: name, style: { fill: 0xffffff, fontSize: 12, fontFamily: 'Inter, system-ui, sans-serif', fontWeight: '700', stroke: { color: 0x0a140e, width: 3 } } });
  label.anchor.set(0.5, 1);
  const glyph = new Text({ text: '', style: { fill: 0xffffff, fontSize: 18, fontFamily: 'Inter, system-ui, sans-serif', fontWeight: '800', stroke: { color: 0x0a140e, width: 4 } } });
  glyph.anchor.set(0.5, 1); glyph.alpha = 0;

  layers.shadows.addChild(shadow); layers.sorted.addChild(node); layers.lights.addChild(halo); layers.overlay.addChild(label, glyph);

  const st = { x: 0, y: 0, sx: 0, sy: 0, svx: 0, svy: 0, heading: 0, phase: 0, moving: false, gaitAmp: 0, squash: 0, lastHeading: 0, tailLag: 0, glyphT: 0, glyphText: '', feedT: 0, init: false };

  function drawTail(t, mk) {
    tail.clear();
    const idle = !st.moving && mk.state !== 'O' && mk.state !== 'J';
    const wag = Math.sin(t * 2.2 + st.phase) * (st.moving ? 7 : 3);
    const lag = st.tailLag * 18;
    // 3 tapered segments along a lagging curve, ending in a prehensile curl
    const p0 = [-12, 0], p1 = [-22, wag * 0.5 + lag], p2 = [-31, wag + lag * 1.3], p3 = [-38, -6 + wag * 0.6 + lag * 1.5];
    const seg = (a, b, w) => tail.moveTo(a[0], a[1]).lineTo(b[0], b[1]).stroke({ width: w, color: dark, cap: 'round' });
    seg(p0, p1, 4.4); seg(p1, p2, 3.6); seg(p2, p3, 2.8);
    const curl = idle ? 1 : 0.35 + 0.25 * Math.sin(t * 1.5);
    tail.moveTo(p3[0], p3[1]);
    for (let k = 1; k <= 8; k++) {
      const a = (k / 8) * Math.PI * 1.5 * curl, rr = 5.5 - k * 0.35;
      tail.lineTo(p3[0] - 2 + Math.cos(a - Math.PI / 2) * rr, p3[1] - rr + Math.sin(a - Math.PI / 2) * rr);
    }
    tail.stroke({ width: 2.2, color: dark, cap: 'round', join: 'round' });
  }
  function drawLimbs() {
    limbs.clear();
    const amp = 9 * st.gaitAmp;
    // long spider-monkey limbs: shoulder → elbow (splayed) → hand; diagonal pairs swing in phase
    const limbDefs = [[8, -6, 1], [8, 6, -1], [-7, -6, -1], [-7, 6, 1]];     // sx, sy, phase sign
    for (let k = 0; k < 4; k++) {
      const [sx, sy, ps] = limbDefs[k], side = Math.sign(sy);
      const sw = Math.sin(st.phase + (ps > 0 ? 0 : Math.PI)) * amp;
      const feedReach = st.feedT > 0 && k < 2 ? Math.max(0, Math.sin(st.feedT * 5)) * 6 : 0;
      const ex = sx + 6 + sw * 0.5 + feedReach, ey = sy + side * 9;
      const hx = sx + 11 + sw + feedReach * 1.4, hy = sy + side * 13 - (k < 2 ? 0 : 2);
      limbs.moveTo(sx, sy).lineTo(ex, ey).lineTo(hx, hy).stroke({ width: 3.2, color: dark, cap: 'round', join: 'round' });
      limbs.circle(hx, hy, 2.1).fill(dark);
    }
  }

  return {
    node, shadow, label, glyph, halo, st,
    /** Called every frame with the interpolated world-space position of the model monkey. */
    update(mk, x, y, dt, t, zoom) {
      if (!st.init) { st.sx = x; st.sy = y; st.init = true; st.heading = Math.atan2(mk.uy, mk.ux); }
      const kPos = damp(22, dt), kVel = damp(9, dt);
      const vx = (x - st.sx) / Math.max(dt, 1e-4), vy = (y - st.sy) / Math.max(dt, 1e-4);
      st.sx += (x - st.sx) * kPos; st.sy += (y - st.sy) * kPos;
      st.svx += (vx - st.svx) * kVel; st.svy += (vy - st.svy) * kVel;
      const speed = Math.hypot(st.svx, st.svy);                       // world m per real s
      if (!st.moving && speed > 9) st.moving = true; else if (st.moving && speed < 4) st.moving = false;
      let target = st.heading;
      if (st.moving) target = Math.atan2(st.svy, st.svx);
      else if (mk.state === 'O' || mk.state === 'J') { const tr = mk.treeRef; if (tr) target = Math.atan2(tr.y - y, tr.x - x); }
      const prev = st.heading;
      st.heading = lerpAngle(st.heading, target, damp(st.moving ? Math.min(12, 3 + speed * 0.08) : 4, dt));
      const turn = wrapAngle(st.heading - prev);
      st.tailLag += (-turn * 4 - st.tailLag) * damp(5, dt);
      st.tailLag = clamp(st.tailLag, -1.2, 1.2);
      // squash on sharp turns, stretch along speed
      st.squash += ((Math.abs(turn) > 0.08 ? -0.10 : 0) - st.squash) * damp(10, dt);
      const stride = 26;
      if (st.moving) st.phase = (st.phase + speed * dt / stride * TAU) % TAU; else st.phase += (0 - wrapAngle(st.phase)) * damp(6, dt);
      st.gaitAmp += ((st.moving ? clamp(speed / 60, 0.35, 1) : 0) - st.gaitAmp) * damp(8, dt);
      st.feedT = (mk.state === 'O' || mk.state === 'J') ? st.feedT + dt : 0;

      const s = clamp(1.15 / zoom, 0.55, 1.6);                           // screen-constant size
      node.position.set(st.sx, st.sy); node.zIndex = st.sy + 4;
      const bob = Math.sin(st.phase * 2) * 1.2 * st.gaitAmp;
      const breathe = st.moving ? 0 : Math.sin(t * 2.1 + i) * 0.025;
      const stretch = 0.05 * st.gaitAmp * Math.sin(st.phase * 2);
      rig.rotation = st.heading;
      rig.scale.set(s * (1 + stretch + st.squash + breathe), s * (1 - stretch - st.squash + breathe * 0.5));
      rig.position.set(0, bob * s);
      node.scale.set(1);
      shadow.position.set(st.sx + 3 * s, st.sy + 7 * s); shadow.width = 46 * s; shadow.height = 22 * s;
      shadow.alpha = 0.34 + 0.08 * st.gaitAmp;

      // head: feeding reach, call lift, confused wiggle
      let hs = 1, hx = 13;
      if (st.feedT > 0) { hx = 13 + Math.max(0, Math.sin(st.feedT * 5)) * 3.5; hs = 1 + 0.06 * Math.sin(st.feedT * 10); }
      if (mk.callT > 0) { hs = 1.25; hx = 15; }
      if (mk.emote === 'confused') head.rotation = Math.sin(t * 9) * 0.25; else head.rotation += (0 - head.rotation) * damp(8, dt);
      head.position.x += (hx - head.position.x) * damp(10, dt); head.scale.set(head.scale.x + (hs - head.scale.x) * damp(12, dt));
      const mouthOpen = mk.callT > 0 ? 1 : (st.feedT > 0 ? 0.4 + 0.4 * Math.max(0, Math.sin(st.feedT * 5)) : 0.001);
      mouth.scale.set(mouth.scale.x + (mouthOpen - mouth.scale.x) * damp(14, dt));
      halo.position.set(st.sx, st.sy); halo.width = halo.height = 70 * s; halo.alpha = mk.callT > 0 ? 0.55 * Math.min(1, mk.callT / 0.4) : halo.alpha * 0.85;

      drawTail(t, mk); drawLimbs();

      label.position.set(st.sx, st.sy - 20 * s); label.scale.set(1 / zoom);
      const glyphText = mk.emote === 'confused' ? '?' : (mk.emote === 'alert' ? '!' : (mk.state === 'M' ? '…' : ''));
      if (glyphText && glyphText !== st.glyphText) { st.glyphText = glyphText; st.glyphT = 1.8; glyph.text = glyphText; glyph.style.fill = glyphText === '!' ? 0xffffff : 0xffd36b; }
      if (mk.emote !== 'confused' && mk.emote !== 'alert' && mk.state !== 'M') st.glyphText = '';
      st.glyphT -= dt;
      glyph.alpha = st.glyphT > 0 ? Math.min(1, st.glyphT * 2) : 0;
      glyph.position.set(st.sx + 10 * s, st.sy - 30 * s - Math.max(0, 1.8 - st.glyphT) * 6); glyph.scale.set(1 / zoom);
      glyph.rotation = glyphText === '?' ? Math.sin(t * 6) * 0.15 : 0;
    },
    setVisible(v) { node.visible = shadow.visible = v; label.visible = v; },
  };
}
