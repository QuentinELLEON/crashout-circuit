/** Affiche le circuit et l'aperçu de pose choisi par le copilote. */
import type { GameState, PlacementTarget, Vec2 } from '../../server/types.js';
import { RaceMap } from '../../client-shared/raceMap/RaceMap.js';
import { toScreen, toWorld, type MapCamera } from '../../client-shared/raceMap/camera2d.js';
import { wallCorners } from '../../server/tangibles/tangibleGeometry.js';
import type { PreparedPlacement } from '../../server/rules/gameplay/remotePlacementGeometry.js';

export class PlacementMap {
  readonly canvas = document.createElement('canvas');
  private readonly map = new RaceMap();
  private readonly ctx = this.canvas.getContext('2d')!;
  private camera: MapCamera | null = null;
  private zoom = 1;

  constructor(select: (pos: Vec2) => void) {
    this.canvas.setAttribute('aria-label', 'Choisir un emplacement sur le circuit');
    this.canvas.addEventListener('click', event => {
      if (!this.camera) return;
      const box = this.canvas.getBoundingClientRect();
      select(toWorld(this.camera, {
        x: (event.clientX - box.left) * this.canvas.width / box.width,
        y: (event.clientY - box.top) * this.canvas.height / box.height,
      }));
    });
  }

  /** Cadre la table entière ou agrandit une zone autour de l'emplacement courant. */
  changeZoom(delta: number): void {
    this.zoom = Math.max(1, Math.min(3, this.zoom + delta * .5));
  }

  /** Redessine la carte et la prévisualisation avec les dimensions courantes de l'écran. */
  draw(state: GameState, target: PlacementTarget, prepared: PreparedPlacement, now: number): void {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.round(this.canvas.clientWidth * ratio), height = Math.round(this.canvas.clientHeight * ratio);
    if (!width || !height) return;
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    const { logicalWidth, logicalHeight } = state.params;
    const camera = this.camera = {
      width, height, rotation: 0,
      center: this.zoom === 1 ? { x: logicalWidth / 2, y: logicalHeight / 2 } : target.pos,
      scale: Math.min(width / (logicalWidth + 40), height / (logicalHeight + 40)) * this.zoom,
    };
    this.map.draw(this.ctx, camera, state, state.cars, now);
    drawPreview(this.ctx, camera, state, target, prepared, ratio);
  }
}

/** Représente la forme, la direction ou l'impact prévu, avec une coche ou une croix. */
function drawPreview(ctx: CanvasRenderingContext2D, camera: MapCamera, state: GameState, target: PlacementTarget,
  prepared: PreparedPlacement, ratio: number): void {
  const valid = !('reason' in prepared);
  const points = previewPoints(state, target, prepared);
  ctx.save();
  ctx.strokeStyle = valid ? '#b1ffc9' : '#ffa993';
  ctx.fillStyle = valid ? '#a7f9c1' : '#ffc7b4';
  ctx.lineWidth = 2 * ratio;
  if (points.length) {
    ctx.beginPath();
    for (const [i, point] of points.entries()) {
      const pixel = toScreen(camera, point);
      if (i === 0) ctx.moveTo(pixel.x, pixel.y);
      else ctx.lineTo(pixel.x, pixel.y);
    }
    if (target.kind === 'tangible') ctx.closePath();
    ctx.stroke();
  }
  const at = toScreen(camera, target.pos);
  ctx.beginPath();
  ctx.arc(at.x, at.y, Math.max(10 * ratio, target.kind === 'slingshot' ? state.params.stoneRadiusPx * camera.scale : 0),
    0, Math.PI * 2);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${17 * ratio}px system-ui`;
  ctx.fillText(valid ? '✓' : '×', at.x, at.y);
  ctx.restore();
}

/** Construit l'emprise du mur, la ligne de boost ou l'axe de tir. */
function previewPoints(state: GameState, target: PlacementTarget, prepared: PreparedPlacement): Vec2[] {
  if (target.kind === 'tangible') {
    const p = state.params;
    const length = target.id === 1 ? p.wallLengthPx : p.pylonBasePx;
    const width = target.id === 1 ? p.wallWidthPx : p.pylonBasePx;
    return wallCorners(target.pos, target.id === 1 ? target.angle : 0, length, width);
  }
  if ('reason' in prepared) return [];
  if (prepared.kind === 'boost') return [prepared.a, prepared.b];
  if (prepared.kind === 'slingshot') return [prepared.pouch, prepared.anchor, target.pos];
  return [];
}
