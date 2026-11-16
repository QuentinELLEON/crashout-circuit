/** Dessine les aplats et montagnes pixelisées de l'horizon Rétro. */
import { RETRO } from '../../../client-shared/theme/retroPalette.js';

export const RETRO_PHONE_SIZE = { width: 320, height: 180 } as const;

/** Compose trois bandes de ciel puis deux crêtes à vitesses de parallaxe différentes. */
export function drawRetroBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number,
  horizon: number, heading: number, motion: number): void {
  const y = Math.round(Math.max(0, Math.min(h, horizon)));
  const sky = [RETRO.rock, RETRO.sky, RETRO.skyLight];
  sky.forEach((color, i) => {
    const top = Math.floor(y * i / 3), bottom = Math.ceil(y * (i + 1) / 3);
    ctx.fillStyle = color;
    ctx.fillRect(0, top, w, bottom - top);
  });
  drawRidge(ctx, w, y, heading * 13, 13, RETRO.mountain);
  drawRidge(ctx, w, y, heading * 24, 7, RETRO.rock);
  for (let row = y; row < h; row += 11) {
    const n = Math.floor((row - y + motion) / 11);
    ctx.fillStyle = n % 2 ? RETRO.grass : RETRO.grassDark;
    ctx.fillRect(0, row, w, 11);
  }
}

/** Monte un relief en créneaux dans le lointain. */
function drawRidge(ctx: CanvasRenderingContext2D, w: number, y: number,
  shift: number, height: number, color: string): void {
  ctx.fillStyle = color;
  const offset = Math.round(shift / 3);
  for (let x = 0; x < w; x += 3) {
    const column = x / 3 + offset;
    const rise = Math.max(2, Math.round(height * (.65 + .35 * Math.sin(column * .25) + .25 * Math.sin(column * .67))));
    ctx.fillRect(x, y - rise, 3, rise);
  }
}
