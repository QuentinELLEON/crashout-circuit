/** Prépare des karts pixelisés dans les seize orientations de la table. */
import type { Car, Team } from '../../../server/types.js';
import { RETRO } from '../../../client-shared/theme/retroPalette.js';

/** Convertit un cap en l'orientation disponible la plus proche. */
export function kartFrame(angle: number): number {
  const frame = Math.round(angle * 8 / Math.PI);
  return ((frame % 16) + 16) % 16;
}

export class RetroKarts {
  private readonly frames = new Map<string, HTMLCanvasElement>();

  /** Pose un kart déjà rasterisé et conserve un repère au sol. */
  draw(ctx: CanvasRenderingContext2D, car: Car): void {
    const frame = kartFrame(car.angle);
    const key = `${car.team}.${frame}.${car.disabled}`;
    let sprite = this.frames.get(key);
    if (!sprite) {
      sprite = this.rasterize(car.team, frame, car.disabled);
      this.frames.set(key, sprite);
    }
    const x = Math.round(car.pos.x / 4) * 4, y = Math.round(car.pos.y / 4) * 4;
    ctx.fillStyle = RETRO.shadow;
    ctx.fillRect(x - 16, y - 4, 36, 16);
    ctx.drawImage(sprite, x - 28, y - 28, 56, 56);
  }

  /** Dessine le kart en quatorze pixels de côté à l'orientation demandée. */
  private rasterize(team: Team, frame: number, disabled: boolean): HTMLCanvasElement {
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 14;
    const ctx = sprite.getContext('2d')!;
    const angle = frame * Math.PI / 8;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    for (let y = 0; y < 14; y++) {
      for (let x = 0; x < 14; x++) {
        const px = (x - 6.5) * cos + (y - 6.5) * sin, py = (y - 6.5) * cos - (x - 6.5) * sin;
        const color = kartPixel(px, py, disabled ? RETRO.asphaltLight : team === 'A' ? RETRO.cyan : RETRO.pink);
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    return sprite;
  }
}

/** Choisit le châssis, l'habitacle ou une roue d'un kart original. */
function kartPixel(x: number, y: number, paint: string): string | null {
  const side = Math.abs(y);
  if (Math.abs(x) > 4.6 || side > 3.8) return null;
  if (side > 2.2) return Math.abs(x) > 2 ? RETRO.night : null;
  if (x < -3.65) return RETRO.red;
  if (x > 3.65) return RETRO.white;
  if (x > -1.5 && x < 1.65 && side < 1.35) return RETRO.rock;
  return paint;
}
