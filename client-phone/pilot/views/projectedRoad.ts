/** Dessine le ruban de chaussée en perspective en préservant les bords du circuit réel. */
import type { TrackGeometry, Vec2 } from '../../../server/types.js';
import { visibleTrackEdges } from '../../../client-shared/trackVisibility.js';
import { boostFrame } from '../../../server/track/boostGeometry.js';
import type { BoostGate } from '../../../server/types.js';
import { clipDepth, FAR, farthestFirst, NEAR, type Projection } from './projection.js';

export type RoadColors = { road: [string, string]; edge: [string, string]; fog: string; boost: string; pixelated?: boolean };

export class ProjectedRoad {
  private track: TrackGeometry | null = null;
  private visibility: boolean[][] = [];
  private readonly segments: { i: number; depth: number }[] = [];

  /** Sélectionne puis dessine les portions visibles du circuit. */
  draw(ctx: CanvasRenderingContext2D, projection: Projection, track: TrackGeometry, colors: RoadColors, reduced: boolean, flicker = 0): void {
    if (track !== this.track) {
      this.track = track;
      this.visibility = visibleTrackEdges(track);
    }
    const center = track.centerline;
    const n = center.length;
    this.segments.length = 0;
    for (let i = 0; i < n; i++) {
      const point = projection.local(center[i]);
      const next = projection.local(center[(i + 1) % n]);
      if (point.depth < -100 && next.depth < -100 || point.depth > FAR + 65 && next.depth > FAR + 65) continue;
      if (Math.abs(point.side) > 460) continue;
      this.segments.push({ i, depth: (point.depth + next.depth) / 2 });
    }
    this.segments.sort(farthestFirst);
    const budget = colors.pixelated ? (reduced ? 36 : 48) : reduced ? 44 : 60;
    for (let s = Math.max(0, this.segments.length - budget); s < this.segments.length; s++) {
      const { i, depth } = this.segments[s];
      const a = track.outerEdge[i], b = track.outerEdge[(i + 1) % n];
      const c = track.innerEdge[(i + 1) % n], d = track.innerEdge[i];
      const band = Math.floor((i + flicker) / 4) % 2;
      const quad = [a, b, c, d];
      drawGround(ctx, projection, quad, colors.road[band]);
      const fog = colors.pixelated ? (depth > 565 ? .65 : 0)
        : Math.min(.88, Math.max(0, (depth - 240) / (FAR - 240)));
      if (this.visibility[0][i]) {
        drawGround(ctx, projection, [a, b, mix(b, c, .06), mix(a, d, .06)], colors.edge[band]);
      }
      if (this.visibility[1][i]) {
        drawGround(ctx, projection, [d, c, mix(c, b, .06), mix(d, a, .06)], colors.edge[band]);
      }
      if (fog > 0) drawGround(ctx, projection, quad, colors.fog, fog);
    }
    drawStart(ctx, projection, track);
  }
}

/** Dessine une surface plane avec une découpe aux limites de la caméra. */
export function drawGround(ctx: CanvasRenderingContext2D, p: Projection, points: Vec2[],
  color: string, alpha = 1): void {
  const visible = clipDepth(points.map(point => p.local(point)));
  if (visible.length < 3) return;
  ctx.beginPath();
  visible.forEach((v, i) => {
    const screen = p.screen(v)!;
    if (i === 0) ctx.moveTo(screen.x, screen.y);
    else ctx.lineTo(screen.x, screen.y);
  });
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  ctx.fill();
  if (alpha === 1) {
    ctx.strokeStyle = color;
    ctx.lineWidth = .55;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** Dessine la zone de boost au sol avec la même emprise que la table. */
export function drawProjectedBoost(ctx: CanvasRenderingContext2D, p: Projection, gate: BoostGate, color: string): void {
  const { forward, depth } = boostFrame(gate);
  const extend = (pos: Vec2) => ({ x: pos.x + forward.x * depth, y: pos.y + forward.y * depth });
  drawGround(ctx, p, [gate.a, gate.b, extend(gate.b), extend(gate.a)], color, .65);
}

/** Projette le damier dans la largeur de piste à la ligne de départ. */
function drawStart(ctx: CanvasRenderingContext2D, p: Projection, track: TrackGeometry): void {
  const { pos, normal } = track.startLine;
  const camera = p.local(pos);
  if (camera.depth < NEAR - 70 || camera.depth > FAR - 70) return;
  const cell = track.widths[track.featureIndices.start] / 16;
  const point = (a: number, b: number) => ({ x: pos.x + a * normal.x - b * normal.y, y: pos.y + a * normal.y + b * normal.x });
  for (let i = 0; i < 16; i++) {
    const left = (i - 8) * cell, right = left + cell;
    drawGround(ctx, p, [point(left, -cell), point(right, -cell), point(right, 0), point(left, 0)], i % 2 ? '#fafafa' : '#182027');
    drawGround(ctx, p, [point(left, 0), point(right, 0), point(right, cell), point(left, cell)], i % 2 ? '#182027' : '#fafafa');
  }
}

/** Interpole la largeur de bordure sur un côté de chaque bande de chaussée. */
function mix(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
