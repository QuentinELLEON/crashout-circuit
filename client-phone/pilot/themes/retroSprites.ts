/** Génère les objets et les cinq silhouettes de kart sans ressource externe. */
import { RETRO } from '../../../client-shared/theme/retroPalette.js';

type Glyph = 'car' | 'box' | 'pylon' | 'wall' | 'stone';
const cache = new Map<string, HTMLCanvasElement>();

/** Dessine un sprite rasterisé à l'un de ses trois niveaux de détail. */
export function drawRetroSprite(ctx: CanvasRenderingContext2D, glyph: Glyph, x: number, y: number,
  w: number, h: number, color: string, turn = 0): void {
  const size = h >= 40 ? 24 : h >= 20 ? 16 : 8;
  const lean = Math.max(-2, Math.min(2, Math.round(turn * 2)));
  const key = `${glyph}.${size}.${color}.${lean}`;
  let sprite = cache.get(key);
  if (!sprite) {
    sprite = rasterize(glyph, size, color, lean);
    cache.set(key, sprite);
  }
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite, Math.round(x - w / 2), Math.round(y - h), Math.max(2, Math.round(w)), Math.max(2, Math.round(h)));
  ctx.restore();
}

/** Construit le sprite avec des rectangles et des marches entières. */
function rasterize(glyph: Glyph, size: number, color: string, turn: number): HTMLCanvasElement {
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = size;
  const ctx = sprite.getContext('2d')!;
  const u = size / 8;
  ctx.scale(u, u);
  ctx.fillStyle = RETRO.shadow;
  ctx.fillRect(1, 7, 6, 1);
  ctx.fillStyle = color;
  if (glyph === 'car') {
    ctx.fillStyle = RETRO.night;
    ctx.fillRect(0, 5, 2, 3);
    ctx.fillRect(6, 5, 2, 3);
    ctx.fillStyle = color;
    ctx.fillRect(1, 4, 6, 3);
    ctx.fillRect(2 + Math.sign(turn), 2, 4, 2);
    ctx.fillRect(3 + turn, 1, 2, 2);
    ctx.fillStyle = RETRO.red;
    ctx.fillRect(1, 5, 1, 1);
    ctx.fillRect(6, 5, 1, 1);
  } else {
    const inset = glyph === 'pylon' ? 2 : 1;
    const top = glyph === 'wall' ? 2 : glyph === 'stone' ? 3 : 1;
    ctx.fillRect(inset, top, 8 - inset * 2, 7 - top);
    ctx.fillStyle = RETRO.white;
    ctx.fillRect(inset, top, 8 - inset * 2, 1);
    ctx.fillStyle = RETRO.purple;
    ctx.fillRect(7 - inset, top + 1, 1, 6 - top);
  }
  return sprite;
}
