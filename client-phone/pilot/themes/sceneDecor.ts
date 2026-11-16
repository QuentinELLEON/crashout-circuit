/** Place des décors déterministes hors chaussée et les dessine dans la perspective du pilote. */
import { RETRO } from '../../../client-shared/theme/retroPalette.js';
import type { TrackGeometry, Vec2 } from '../../../server/types.js';
import { isInsideTrackRibbon, trackTangent } from '../../../server/geometry.js';
import { LOGICAL_H, LOGICAL_W } from '../../../server/layout.js';
import { farthestFirst, type Projection, type ScreenPoint } from '../views/projection.js';
import type { PilotTheme } from './theme.js';

type Decor = { pos: Vec2; scale: number; variant: number };

/** Choisit des positions stables et assez éloignées pour laisser la piste se déformer. */
export function generateSceneDecor(track: TrackGeometry, seed: number, margin: number): Decor[] {
  const pure = { centerline: track.baseCenterline, widths: track.widths };
  const decor: Decor[] = [];
  for (let i = 0; i < pure.centerline.length; i += 12) {
    const center = pure.centerline[i];
    const normal = trackTangent(pure, i);
    const random = hash(seed + i * 7789);
    for (const side of [-1, 1]) {
      const distance = pure.widths[i] / 2 + margin + 26 + random * 104;
      const pos = { x: center.x - normal.y * distance * side, y: center.y + normal.x * distance * side };
      if (pos.x < 10 || pos.y < 10 || pos.x > LOGICAL_W - 10 || pos.y > LOGICAL_H - 10) continue;
      if (isInsideTrackRibbon(pos, pure, -margin)) continue;
      decor.push({ pos, scale: .75 + random * .6, variant: Math.floor(random * 3) });
    }
  }
  return decor;
}

export class SceneDecor {
  private signature = '';
  private items: Decor[] = [];

  /** Redessine le décor en conservant ses positions lorsque la chaussée se déforme. */
  draw(ctx: CanvasRenderingContext2D, p: Projection, track: TrackGeometry, version: number, margin: number,
    theme: PilotTheme, slow: boolean, time: number): void {
    const signature = track.baseCenterline.filter((_, i) => i % 24 === 0)
      .map(point => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join('|');
    if (signature !== this.signature) {
      this.signature = signature;
      this.items = generateSceneDecor(track, version, margin);
    }
    const visible: (ScreenPoint & { decor: Decor })[] = [];
    for (const decor of this.items) {
      const point = p.screen(p.local(decor.pos));
      if (!point || point.x < -80 || point.x > p.width + 80 || slow && point.depth > 330) continue;
      visible.push({ ...point, decor });
    }
    visible.sort(farthestFirst);
    for (const point of visible) paintDecor(ctx, point, theme, time);
  }
}

/** Dessine un élément caractéristique de l'ambiance au bord de la route. */
function paintDecor(ctx: CanvasRenderingContext2D, p: ScreenPoint & { decor: Decor }, theme: PilotTheme, time: number): void {
  const size = Math.min(90, 42 * p.scale * p.decor.scale);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.globalAlpha = Math.max(.25, 1 - p.depth / 950);
  ctx.fillStyle = theme.material;
  ctx.strokeStyle = theme.accent;
  switch (theme.motif) {
    case 'column':
      ctx.fillRect(-size * .2, -size * 1.9, size * .4, size * 1.9);
      ctx.strokeRect(-size * .2, -size * 1.9, size * .4, size * 1.9);
      ctx.fillStyle = theme.lights;
      ctx.fillRect(-size * .04, -size * 1.8, size * .08, size * 1.7);
      break;
    case 'pipes':
      ctx.fillRect(-size * .2, -size * 1.35, size * .4, size * 1.35);
      ctx.fillRect(-size * .5, -size * 1.42, size * .7, size * .24);
      ctx.strokeRect(-size * .5, -size * 1.42, size * .7, size * .24);
      if (time) {
        ctx.globalAlpha *= .35;
        ctx.beginPath();
        ctx.arc(-size * .45, -size * (1.55 + (time % 1500) / 1500), size * .27, 0, Math.PI * 2);
        ctx.fillStyle = '#dfe7e5';
        ctx.fill();
      }
      break;
    case 'blocks':
      ctx.fillStyle = p.decor.variant % 2 ? theme.accent : theme.lights;
      ctx.fillRect(-size * .56, -size * .52, size * 1.12, size * .52);
      ctx.fillRect(-size * .37, -size * .68, size * .28, size * .16);
      ctx.fillRect(size * .07, -size * .68, size * .28, size * .16);
      break;
    case 'stands':
      for (let i = 0; i < 3; i++) ctx.fillRect(-size * (1 - i * .14), -size * (.34 + i * .26), size * (2 - i * .28), size * .26);
      ctx.strokeRect(-size / 2, -size * 1.05, size, size * .18);
      break;
    case 'pixel':
      ctx.globalAlpha = p.depth < 520 ? 1 : 0;
      drawPixelDecor(ctx, Math.max(6, Math.round(size)), p.decor.variant);
      break;
    case 'tents':
      ctx.beginPath(); ctx.moveTo(-size, 0); ctx.lineTo(0, -size * 1.25); ctx.lineTo(size, 0); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = theme.accent;
      ctx.fillRect(-size * .1, -size * .56, size * .2, size * .56);
      break;
  }
  ctx.restore();
}

/** Produit une valeur reproductible entre zéro et un. */
function hash(seed: number): number {
  return ((Math.imul(seed ^ (seed >>> 16), 0x45d9f3b) >>> 0) % 65536) / 65536;
}

/** Dessine les silhouettes pixellisées du bord de piste. */
function drawPixelDecor(ctx: CanvasRenderingContext2D, size: number, variant: number): void {
  const half = Math.round(size / 2);
  ctx.fillStyle = RETRO.shadow;
  ctx.fillRect(-half + 2, 0, size, 3);
  if (variant === 0) {
    ctx.fillStyle = RETRO.dark;
    ctx.fillRect(-2, -half, 4, half);
    ctx.fillStyle = RETRO.leaf;
    ctx.fillRect(-half, -size + 3, size, half);
    ctx.fillRect(-half + 3, -size, size - 6, half);
  } else {
    ctx.fillStyle = variant === 1 ? RETRO.dark : RETRO.rock;
    ctx.fillRect(-half, -half - 3, size, half + 3);
    ctx.fillStyle = variant === 1 ? RETRO.yellow : RETRO.cloud;
    ctx.fillRect(-half + 2, -half - 1, size - 4, 3);
    ctx.fillStyle = RETRO.red;
    ctx.fillRect(-half + 2, -4, size - 4, 2);
  }
}
