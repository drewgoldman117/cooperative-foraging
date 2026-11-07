// render/forest.js — procedural soft-vector jungle: ground, trees (two species, 3 value steps,
// fruit that depletes/regrows), undergrowth tufts, foreground canopy fringe, dappled light.
import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js';
import { PAL, TAU, lerpColor, clamp } from './palette.js';
import { softBlob, dappleTexture, groundTexture } from './textures.js';
import { mulberry32 } from '../sim/rng.js';
import { ARENA } from '../sim/abm.js';

const OLIVE_TINT = 0xD8CDA0;   // multiplied onto a depleted canopy

export function createForest(world, layers, reduced) {
  const { ground, shadows, sorted, lights, fringe: fringeLayer } = layers;
  const rng = mulberry32(world.seed * 13 + 5);

  // ---- outer forest + floor --------------------------------------------------
  const outer = new Graphics().rect(-600, -600, ARENA.w + 1200, ARENA.h + 1200).fill(0x10201a);
  ground.addChild(outer);
  const floor = new Sprite(groundTexture(ARENA.w, ARENA.h, world.seed));
  ground.addChild(floor);
  // soft dark edge so the arena floor melts into the outer forest
  const edge = new Graphics();
  for (let k = 0; k < 4; k++) {
    const inset = -k * 10;
    edge.rect(inset, inset, ARENA.w - 2 * inset, ARENA.h - 2 * inset).stroke({ width: 24, color: 0x0e1a13, alpha: 0.18 });
  }
  ground.addChild(edge);

  // undergrowth tufts
  const tufts = new Graphics();
  for (let k = 0; k < 220; k++) {
    const x = rng() * ARENA.w, y = rng() * ARENA.h, s = 3 + rng() * 4, col = rng() < 0.5 ? 0x2a4a33 : 0x1f3a28;
    for (let b = 0; b < 4; b++) {
      const a = -Math.PI / 2 + (b - 1.5) * 0.45 + (rng() - 0.5) * 0.2, l = s * (0.8 + rng() * 0.6);
      tufts.moveTo(x, y).lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l).stroke({ width: 1.6, color: col, alpha: 0.9, cap: 'round' });
    }
  }
  ground.addChild(tufts);

  // dappled light (additive, drifts slowly, alpha follows the sun)
  const dapple = new TilingSprite({ texture: dappleTexture(512, world.seed), width: ARENA.w + 400, height: ARENA.h + 400 });
  dapple.position.set(-200, -200); dapple.tileScale.set(0.8); dapple.blendMode = 'add'; dapple.alpha = 0.2;
  ground.addChild(dapple);

  // ---- trees ----------------------------------------------------------------
  const trees = world.trees.map(tr => makeTree(tr, rng));
  for (const t of trees) { shadows.addChild(t.shadow); sorted.addChild(t.node); lights.addChild(t.glow); }

  // ---- foreground canopy fringe around the arena ----------------------------
  const fringes = [];
  const perim = [];
  const step = 95;
  for (let x = -60; x <= ARENA.w + 60; x += step) { perim.push([x, -50 + rng() * 25]); perim.push([x, ARENA.h + 50 - rng() * 25]); }
  for (let y = 40; y < ARENA.h - 40; y += step) { perim.push([-55 + rng() * 25, y]); perim.push([ARENA.w + 55 - rng() * 25, y]); }
  for (const [x, y] of perim) {
    const g = new Graphics();
    const R = 58 + rng() * 40;
    const cols = rng() < 0.5 ? [0x0f2419, 0x173322, 0x1f4330] : [0x0f231c, 0x163229, 0x1e4436];
    drawCanopy(g, R, cols, rng, 7, 0.35);
    g.position.set(x, y); g.alpha = 0.96; g.rotation = rng() * TAU;
    g.swayPhase = rng() * TAU; g.swayRate = 0.5 + rng() * 0.4; g.baseRot = g.rotation;
    fringeLayer.addChild(g); fringes.push(g);
  }

  let time = 0;
  return {
    trees, dapple,
    update(dt, sun) {
      time += dt;
      dapple.alpha = 0.05 + 0.20 * sun;
      dapple.tilePosition.x += dt * 9; dapple.tilePosition.y += dt * 4;
      for (const t of trees) t.update(dt, time, reduced);
      if (!reduced) for (const f of fringes) f.rotation = f.baseRot + Math.sin(time * f.swayRate + f.swayPhase) * 0.02;
    },
    punch(k) { trees[k].punch = 1; },
  };
}

function drawCanopy(g, r, cols, rng, nLobes = 8, hiScale = 0.55, lobes = null) {
  const L = lobes || Array.from({ length: nLobes }, () => [(rng() - 0.5), (rng() - 0.5), 0.45 + rng() * 0.4]);
  // 3 value steps: shadow layer offset down-right, mid, highlight up-left (light from top-left)
  const passes = [[cols[0], 4, 6, 1.0], [cols[1], 0, 0, 0.92], [cols[2], -3, -5, hiScale]];
  for (const [col, ox, oy, sc] of passes) {
    for (const [lx, ly, lr] of L) g.circle(lx * r * 0.95 + ox, ly * r * 0.75 + oy, lr * r * sc).fill(col);
  }
  return L;
}

function makeTree(tr, rng) {
  const node = new Container();
  node.position.set(tr.x, tr.y);
  node.zIndex = tr.y + tr.r * 0.4;
  const R = tr.r * 1.35;
  const cols = tr.species ? PAL.ramon : PAL.ficus;

  const shadow = new Sprite(softBlob(128, 0.25));
  shadow.anchor.set(0.5); shadow.tint = PAL.shadow; shadow.alpha = 0.55;
  shadow.width = R * 2.7; shadow.height = R * 1.6; shadow.position.set(tr.x + 9, tr.y + 14);

  const trunk = new Graphics().circle(0, R * 0.55, tr.r * 0.28).fill(PAL.trunk);
  const canopy = new Graphics();
  drawCanopy(canopy, R, cols, rng, 8, 0.55, tr.lobes);
  // tiny leaf vein highlights
  for (let k = 0; k < 4; k++) {
    const a = rng() * TAU, rr = R * (0.2 + rng() * 0.5);
    canopy.circle(Math.cos(a) * rr - 3, Math.sin(a) * rr * 0.75 - 5, 2.2).fill({ color: 0xffffff, alpha: 0.10 });
  }
  const fruit = new Graphics();
  node.addChild(trunk, canopy, fruit);

  const glow = new Sprite(softBlob(128, 0.1));
  glow.anchor.set(0.5); glow.tint = PAL.fruit; glow.blendMode = 'add'; glow.width = glow.height = R * 2.2;
  glow.position.set(tr.x - 2, tr.y - 4); glow.alpha = 0;

  const t = {
    node, shadow, glow, canopy, fruit, tr, R, cols,
    swayPhase: tr.phase, swayRate: 0.7 + rng() * 0.5, punch: 0, fVis: tr.fruit, lastDrawn: -1,
    update(dt, time, reduced) {
      // visual fruit level lags the model (damp 3/s) so depletion reads as a slow fade
      this.fVis += (tr.fruit - this.fVis) * Math.min(1, dt * 3);
      const n = Math.round(this.fVis * 12);
      if (n !== this.lastDrawn) { this.lastDrawn = n; this.drawFruit(n); }
      const dep = 1 - clamp((this.fVis - 0.05) / 0.6, 0, 1);
      canopy.tint = lerpColor(0xffffff, OLIVE_TINT, dep * 0.85);
      glow.alpha = this.fVis > 0.6 ? 0.22 * (this.fVis - 0.6) / 0.4 : 0;
      if (this.punch > 0) { this.punch = Math.max(0, this.punch - dt * 4); }
      const sc = 1 + 0.10 * Math.sin(Math.PI * this.punch) * (this.punch > 0 ? 1 : 0);
      node.scale.set(sc);
      node.rotation = reduced ? 0 : Math.sin(time * this.swayRate + this.swayPhase) * 0.026;
    },
    drawFruit(n) {
      fruit.clear();
      const ripe = this.fVis >= 0.5;
      for (let k = 0; k < n; k++) {
        const [a, rf] = tr.fruitSpots[k];
        const x = Math.cos(a) * R * rf * 0.9 - 2, y = Math.sin(a) * R * rf * 0.7 - 4;
        if (ripe) {
          fruit.circle(x, y, 3.1).fill(PAL.fruit);
          fruit.circle(x - 0.9, y - 0.9, 1.0).fill({ color: PAL.fruitHi, alpha: 0.9 });
        } else {
          fruit.circle(x, y, 2.2).fill({ color: PAL.fruitUnripe, alpha: 0.5 });
        }
      }
    },
  };
  t.drawFruit(Math.round(tr.fruit * 12));
  return t;
}
