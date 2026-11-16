/** Projette les obstacles, les objets et l'autre voiture à leur profondeur réelle. */
import type { GameState, Team, Vec2 } from '../../../server/types.js';
import { CAR_COLORS, type CarPose } from '../../../client-shared/raceMap/objects2d.js';
import { clipLineDepth, FAR, farthestFirst, type Projection, type ScreenPoint } from './projection.js';
import { drawGround, drawProjectedBoost } from './projectedRoad.js';

type Sprite = ScreenPoint & { glyph: 'car' | 'box' | 'pylon' | 'wall' | 'stone'; color: string; w: number; h: number };

export class ProjectedObjects {
  private readonly sprites: Sprite[] = [];

  /** Compose les surfaces au sol, puis les objets du plus éloigné au plus proche. */
  draw(ctx: CanvasRenderingContext2D, p: Projection, state: GameState,
    poses: Record<Team, CarPose>, own: Team, now: number, boost: string): void {
    this.sprites.length = 0;
    for (const gate of state.boostGates) drawProjectedBoost(ctx, p, gate, boost);
    this.addStones(ctx, p, state, now);
    for (const arc of state.arcs) {
      if (arc.disabledUntil <= now) drawArc(ctx, p, arc.pylon1, arc.pylon2);
    }
    for (const tangible of Object.values(state.tangibles)) {
      if (tangible.kind !== 'pylon' || tangible.status !== 'placed') continue;
      this.add(p, { x: tangible.x * state.params.logicalWidth, y: tangible.y * state.params.logicalHeight },
        'pylon', tangible.active ? '#beabff' : '#807799', 26, 55);
    }
    for (const wall of state.walls) {
      const sideFacing = Math.abs(Math.sin(wall.angle * Math.PI / 180 - p.camera.heading));
      const width = sideFacing * wall.lengthPx + (1 - sideFacing) * (wall.widthPx ?? state.params.wallWidthPx);
      this.add(p, wall.pos, 'wall', wall.disabledUntil > now ? '#88796c' : '#f4aa67', width, 44);
    }
    for (const pickup of state.pickups) {
      if (pickup.respawnAt <= now) this.add(p, pickup.pos, 'box', pickup.kind === 'boost' ? '#ffdd71' : '#f4a4ed', 24, 32);
    }
    const opponent = own === 'A' ? 'B' : 'A';
    this.add(p, poses[opponent].pos, 'car', state.cars[opponent].disabled ? '#a7a9ad' : CAR_COLORS[opponent], 32, 25);
    this.sprites.sort(farthestFirst);
    for (const sprite of this.sprites) drawSprite(ctx, sprite);
  }

  /** Ajoute un élément visible et conserve ses dimensions avant tri. */
  private add(p: Projection, pos: Vec2, glyph: Sprite['glyph'], color: string, w: number, h: number, lift = 0): void {
    const point = p.screen(p.local(pos, lift));
    if (!point || point.x < -w * point.scale || point.x > p.width + w * point.scale) return;
    this.sprites.push({ ...point, glyph, color, w, h });
  }

  /** Dessine les avertissements d'impact et calcule la trajectoire des projectiles en cours. */
  private addStones(ctx: CanvasRenderingContext2D, p: Projection, state: GameState, now: number): void {
    for (const stone of state.stones) {
      const radius = state.params.stoneRadiusPx;
      const outline = Array.from({ length: 16 }, (_, i) => {
        const a = i * Math.PI / 8;
        return { x: stone.target.x + Math.cos(a) * radius, y: stone.target.y + Math.sin(a) * radius };
      });
      drawGround(ctx, p, outline, '#fa635d', .52);
      const t = Math.max(0, Math.min(1, (now - stone.launchedAt) / Math.max(1, stone.impactAt - stone.launchedAt)));
      this.add(p, { x: stone.from.x + (stone.target.x - stone.from.x) * t,
        y: stone.from.y + (stone.target.y - stone.from.y) * t }, 'stone', '#eeab85', 20, 18, Math.sin(t * Math.PI) * 80);
    }
  }
}

/** Relie les deux piliers même lorsqu'une des extrémités est trop proche de la caméra. */
function drawArc(ctx: CanvasRenderingContext2D, p: Projection, a: Vec2, b: Vec2): void {
  const visible = clipLineDepth(p.local(a, 35), p.local(b, 35));
  if (!visible) return;
  const from = p.screen(visible[0])!, to = p.screen(visible[1])!;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.lineWidth = Math.max(2, Math.min(7, (from.scale + to.scale) * 1.5));
  ctx.strokeStyle = '#d6c6ff';
  ctx.stroke();
}

/** Dessine un objet visible avec une silhouette distincte et une atténuation à distance. */
function drawSprite(ctx: CanvasRenderingContext2D, s: Sprite): void {
  const w = s.w * s.scale, h = s.h * s.scale;
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.globalAlpha = 1 - .75 * (s.depth / FAR) ** 2;
  ctx.fillStyle = s.color;
  if (s.glyph === 'car') {
    ctx.fillStyle = '#0f151a';
    ctx.fillRect(-w * .59, -h * .46, w * 1.18, h * .46);
    ctx.fillStyle = s.color;
    ctx.fillRect(-w / 2, -h * .66, w, h * .51);
    ctx.fillRect(-w * .35, -h, w * .7, h * .49);
    ctx.fillStyle = '#ff7d70';
    ctx.fillRect(-w * .45, -h * .53, w * .2, h * .13);
    ctx.fillRect(w * .25, -h * .53, w * .2, h * .13);
  } else if (s.glyph === 'box' || s.glyph === 'stone') {
    ctx.translate(0, -h / 2);
    ctx.rotate(s.glyph === 'box' ? Math.PI / 4 : .18);
    ctx.fillRect(-w * .35, -w * .35, w * .7, w * .7);
    ctx.strokeStyle = '#ffffff80';
    ctx.strokeRect(-w * .35, -w * .35, w * .7, w * .7);
  } else {
    ctx.fillRect(-w / 2, -h, w, h);
    ctx.fillStyle = '#ffffff40';
    ctx.fillRect(-w / 2, -h, w, h * .18);
    ctx.fillStyle = '#170f1744';
    ctx.fillRect(w * .24, -h, w * .26, h);
  }
  ctx.restore();
}
