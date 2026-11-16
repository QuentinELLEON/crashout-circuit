/** Met en cache la piste vue du dessus, y compris les croisements et le damier. */
import type { GameState, TrackGeometry, Vec2 } from '../../server/types.js';
import { LOGICAL_H, LOGICAL_W } from '../../server/layout.js';
import { visibleTrackEdges } from '../trackVisibility.js';

export type MapColors = {
  ground: string; road: string; edge: string; roadAlt?: string; kerb?: string; shadow?: string;
};
export const MAP_COLORS: MapColors = { ground: '#17242c', road: '#455460', edge: '#dee7ec' };

export class TrackLayer {
  private readonly layer = document.createElement('canvas');
  private version = -1;
  private colors: MapColors | null = null;
  private start = true;
  builds = 0;

  constructor(private readonly density = 1) {}

  /** Retourne le calque en le redessinant seulement si la géométrie ou le style a changé. */
  get(state: Pick<GameState, 'track' | 'trackVersion'>, colors = MAP_COLORS, start = true): HTMLCanvasElement {
    if (this.version === state.trackVersion && this.colors === colors && this.start === start) return this.layer;
    this.version = state.trackVersion;
    this.colors = colors;
    this.start = start;
    this.builds++;
    this.layer.width = Math.round(LOGICAL_W * this.density);
    this.layer.height = Math.round(LOGICAL_H * this.density);
    const ctx = this.layer.getContext('2d')!;
    ctx.scale(this.density, this.density);
    if (state.track) paintTrack(ctx, state.track, colors, start);
    return this.layer;
  }
}

/** Remplit les bandes de chaussée puis trace leurs seules bordures visibles. */
function paintTrack(ctx: CanvasRenderingContext2D, track: TrackGeometry, colors: MapColors, start: boolean): void {
  const { outerEdge, innerEdge, startLine, widths, featureIndices } = track;
  const edges = [outerEdge, innerEdge];
  const visible = visibleTrackEdges(track);
  if (colors.shadow) {
    ctx.save();
    ctx.translate(7, 12);
    fillRibbon(ctx, outerEdge, innerEdge, colors.shadow);
    ctx.restore();
  }
  fillRibbon(ctx, outerEdge, innerEdge, colors.road);
  if (colors.roadAlt) {
    ctx.fillStyle = colors.roadAlt;
    for (let i = 0; i < outerEdge.length; i++) {
      if (Math.floor(i / 5) % 2 === 0) continue;
      ctx.beginPath();
      traceStrip(ctx, outerEdge, innerEdge, i);
      ctx.fill();
    }
  }
  for (const [side, edge] of edges.entries()) {
    for (let i = 0; i < edge.length; i++) {
      const next = (i + 1) % edge.length;
      if (!visible[side][i] || !visible[side][next]) continue;
      ctx.strokeStyle = colors.kerb && Math.floor(i / 2) % 2 ? colors.kerb : colors.edge;
      ctx.lineWidth = colors.kerb ? 12 : 5;
      ctx.beginPath();
      trace(ctx, [edge[i], edge[next]]);
      ctx.stroke();
    }
  }
  if (!start) return;
  ctx.save();
  ctx.translate(startLine.pos.x, startLine.pos.y);
  ctx.rotate(Math.atan2(startLine.normal.y, startLine.normal.x));
  const cell = widths[featureIndices.start] / 16;
  for (let i = 0; i < 16; i++) {
    for (let r = 0; r < 2; r++) {
      ctx.fillStyle = (i + r) % 2 ? '#101821' : '#fff';
      ctx.fillRect((i - 8) * cell, (r - 1) * cell, cell + .3, cell + .3);
    }
  }
  ctx.restore();
}

/** Remplit le ruban en une opération, y compris lorsqu'il se croise. */
function fillRibbon(ctx: CanvasRenderingContext2D, outer: Vec2[], inner: Vec2[], color: string): void {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < outer.length; i++) traceStrip(ctx, outer, inner, i);
  ctx.fill();
  ctx.stroke();
}

/** Ajoute un segment du ruban au chemin actif. */
function traceStrip(ctx: CanvasRenderingContext2D, outer: Vec2[], inner: Vec2[], i: number): void {
  const next = (i + 1) % outer.length;
  trace(ctx, [outer[i], outer[next], inner[next], inner[i]]);
  ctx.closePath();
}

/** Ajoute les points d'une forme au chemin actif. */
function trace(ctx: CanvasRenderingContext2D, [first, ...rest]: Vec2[]): void {
  ctx.moveTo(first.x, first.y);
  for (const point of rest) ctx.lineTo(point.x, point.y);
}
