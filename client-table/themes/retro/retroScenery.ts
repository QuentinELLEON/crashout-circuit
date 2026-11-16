/** Peint des décors pixelisés originaux avec un éclairage constant. */
import { LOGICAL_H, LOGICAL_W } from '../../../server/layout.js';
import { RETRO } from '../../../client-shared/theme/retroPalette.js';
import { layoutScenery, type SceneryPresentation } from '../SceneryLayout.js';
import type { TrackGeometry } from '../../../server/types.js';

/** Peint la pelouse et des silhouettes statiques hors chaussée. */
export function paintRetroScenery(ctx: CanvasRenderingContext2D, track: TrackGeometry | null, mode: SceneryPresentation): void {
  for (let y = 0; y < LOGICAL_H; y += 64) {
    ctx.fillStyle = Math.floor(y / 64) % 2 ? RETRO.grassDark : RETRO.grass;
    ctx.fillRect(0, y, LOGICAL_W, 64);
  }
  const layout = layoutScenery(track, mode);
  for (const place of layout.anchors) {
    const size = Math.min(52, place.room * .8);
    const x = Math.round(place.x / 4) * 4, y = Math.round(place.y / 4) * 4;
    if (place.seed % 4 === 0) drawStand(ctx, x, y, size);
    else if (place.seed % 4 === 1) {
      ctx.fillStyle = RETRO.cloud;
      ctx.fillRect(x - size * .6, y, size * 1.2, size * .38);
      ctx.fillRect(x - size * .35, y - size * .21, size * .72, size * .58);
    } else if (place.seed % 4 === 2) {
      ctx.fillStyle = RETRO.dark;
      ctx.fillRect(x - 4, y - size * .1, 8, size * .68);
      ctx.fillStyle = RETRO.yellow;
      ctx.fillRect(x - size * .63, y - size * .5, size * 1.26, size * .45);
      ctx.fillStyle = RETRO.red;
      ctx.fillRect(x - size * .4, y - size * .38, size * .8, size * .16);
    } else drawTree(ctx, x, y, size);
  }
  if (mode !== 'race') {
    ctx.fillStyle = mode === 'map' ? '#17274155' : '#172741a0';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  }
}

/** Compose un arbre à la cime crantée et son ombre. */
function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.fillStyle = RETRO.shadow;
  ctx.fillRect(x - size * .37 + 12, y + 8, size * 1.25, size * .45);
  ctx.fillStyle = RETRO.dark;
  ctx.fillRect(x - size * .13, y - size * .1, size * .26, size * .5);
  ctx.fillStyle = RETRO.leaf;
  ctx.fillRect(x - size * .65, y - size * .71, size * 1.3, size * .68);
  ctx.fillRect(x - size * .42, y - size, size * .84, size * .96);
}

/** Compose une tribune à gradins sans texture externe. */
function drawStand(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.fillStyle = RETRO.shadow;
  ctx.fillRect(x - size + 12, y - size * .6 + 10, size * 2, size);
  ctx.fillStyle = RETRO.night;
  ctx.fillRect(x - size, y - size * .6, size * 2, size);
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i === 0 ? RETRO.yellow : i === 1 ? RETRO.red : RETRO.light;
    ctx.fillRect(x - size * .86, y - size * (.46 - i * .25), size * 1.72, size * .18);
  }
}
