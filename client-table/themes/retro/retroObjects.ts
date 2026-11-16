/** Dessine les obstacles, les bonus et les retours de course avec des pixels visibles. */
import type { GameState, Vec2 } from '../../../server/types.js';
import type { Effect } from '../../view.js';
import { RETRO } from '../../../client-shared/theme/retroPalette.js';
import { boostFrame } from '../../../server/track/boostGeometry.js';
import { wallCorners } from '../../../server/tangibles/tangibleGeometry.js';

/** Dessine les objets au sol et en relief, en utilisant leur emprise de collision réelle. */
export function drawRetroObjects(ctx: CanvasRenderingContext2D, state: GameState, now: number, time: number, reduced: boolean): void {
  for (const gate of state.boostGates) {
    const { forward, depth } = boostFrame(gate);
    const far = (p: Vec2) => ({ x: p.x + forward.x * depth, y: p.y + forward.y * depth });
    polygon(ctx, [gate.a, gate.b, far(gate.b), far(gate.a)], RETRO.yellow, .75);
    const color = reduced || Math.floor(time / 160) % 2 === 0 ? RETRO.white : RETRO.orange;
    squaresOnLine(ctx, gate.a, gate.b, color, 13, 8);
  }
  for (const pickup of state.pickups) {
    if (pickup.respawnAt > now) continue;
    const x = pickup.pos.x, y = pickup.pos.y;
    ctx.fillStyle = RETRO.shadow;
    ctx.fillRect(x - 8, y + 4, 24, 12);
    ctx.fillStyle = pickup.kind === 'boost' ? RETRO.yellow : RETRO.lilac;
    ctx.fillRect(x - 12, y - 16, 24, 20);
    ctx.fillStyle = RETRO.white;
    ctx.fillRect(x - 8, y - 12, 7, 6);
  }
  for (const wall of state.walls) {
    const corners = wallCorners(wall.pos, wall.angle, wall.lengthPx, wall.widthPx ?? state.params.wallWidthPx);
    prism(ctx, corners, wall.disabledUntil > now ? RETRO.rock : RETRO.orange);
  }
  for (const arc of state.arcs) {
    if (arc.disabledUntil <= now) squaresOnLine(ctx, arc.pylon1, arc.pylon2, RETRO.lilac, 8, 6);
  }
  for (const tangible of Object.values(state.tangibles)) {
    if (tangible.kind === 'pylon' && tangible.status === 'placed') {
      const pos = { x: tangible.x * state.params.logicalWidth, y: tangible.y * state.params.logicalHeight };
      prism(ctx, wallCorners(pos, 0, state.params.pylonBasePx, state.params.pylonBasePx),
        tangible.active ? RETRO.lilac : RETRO.purple);
    }
  }
}

/** Pose les étincelles carrées des retours de course et réduit leur mouvement si demandé. */
export function drawRetroEffects(ctx: CanvasRenderingContext2D, effects: readonly Effect[], time: number, reduced: boolean): void {
  for (const effect of effects) {
    const age = (time - effect.start) / effect.dur;
    if (age < 0 || age >= 1) continue;
    if (!['stoneHit', 'stoneImpact', 'repairDone', 'pickup', 'boostGate'].includes(effect.kind)) continue;
    ctx.fillStyle = effect.kind === 'repairDone' ? RETRO.leaf : RETRO.yellow;
    ctx.globalAlpha = 1 - age;
    for (let i = 0; i < (reduced ? 4 : 10); i++) {
      const distance = 14 + (reduced ? 0 : 62 * age);
      const x = effect.x + Math.cos(i * Math.PI / 5) * distance;
      const y = effect.y + Math.sin(i * Math.PI / 5) * distance;
      ctx.fillRect(Math.round(x / 4) * 4, Math.round(y / 4) * 4, 8, 8);
    }
    ctx.globalAlpha = 1;
  }
}

/** Donne à l'obstacle un sommet éclairé et une face de douze pixels logiques. */
function prism(ctx: CanvasRenderingContext2D, base: Vec2[], top: string): void {
  polygon(ctx, base.map(p => ({ x: p.x + 10, y: p.y + 12 })), RETRO.shadow);
  polygon(ctx, base, RETRO.purple);
  polygon(ctx, base.map(p => ({ x: p.x - 2, y: p.y - 12 })), top);
}

/** Remplit un contour au niveau du pixel de la scène. */
function polygon(ctx: CanvasRenderingContext2D, vertices: Vec2[], fill: string, alpha = 1): void {
  ctx.fillStyle = fill;
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  for (const [i, point] of vertices.entries()) {
    const x = Math.round(point.x / 4) * 4, y = Math.round(point.y / 4) * 4;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** Aligne des carrés sur un arc ou une zone de boost. */
function squaresOnLine(ctx: CanvasRenderingContext2D, a: Vec2, b: Vec2, color: string, spacing: number, size: number): void {
  const n = Math.max(1, Math.ceil(Math.hypot(a.x - b.x, a.y - b.y) / spacing));
  ctx.fillStyle = color;
  for (let i = 0; i <= n; i++) {
    const x = Math.round((a.x + (b.x - a.x) * i / n) / 4) * 4;
    const y = Math.round((a.y + (b.y - a.y) * i / n) / 4) * 4;
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
  }
}
