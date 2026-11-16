/** Transforme la chaussée et les objets en points d'une caméra perspective. */
import type { Vec2 } from '../../../server/types.js';

export type Camera = { pos: Vec2; heading: number; height: number; pitch: number };
export type CameraPoint = { side: number; down: number; depth: number };
export type ScreenPoint = Vec2 & { depth: number; scale: number };

export const NEAR = 20;
export const FAR = 700;

export class Projection {
  readonly focal: number;
  readonly horizon: number;
  private readonly sin: number;
  private readonly cos: number;
  private readonly pitchCos: number;
  private readonly pitchSin: number;

  constructor(readonly camera: Camera, readonly width: number, height: number, fov = 70) {
    this.sin = Math.sin(camera.heading);
    this.cos = Math.cos(camera.heading);
    this.pitchCos = Math.cos(camera.pitch);
    this.pitchSin = Math.sin(camera.pitch);
    this.focal = width / (2 * Math.tan(fov * Math.PI / 360));
    this.horizon = height * .4;
  }

  /** Applique le cap puis l'inclinaison verticale de la caméra. */
  local(p: Vec2, height = 0): CameraPoint {
    const x = p.x - this.camera.pos.x, y = p.y - this.camera.pos.y;
    const ahead = x * this.cos + y * this.sin;
    const vertical = this.camera.height - height;
    return {
      side: -x * this.sin + y * this.cos,
      down: vertical * this.pitchCos - ahead * this.pitchSin,
      depth: ahead * this.pitchCos + vertical * this.pitchSin,
    };
  }

  /** Donne les coordonnées et l'échelle d'un point dans la zone visible. */
  screen(p: CameraPoint): ScreenPoint | null {
    if (p.depth < NEAR || p.depth > FAR) return null;
    const scale = this.focal / p.depth;
    return { x: this.width / 2 + p.side * scale, y: this.horizon + p.down * scale, depth: p.depth, scale };
  }
}

/** Découpe un contour aux plans proches et lointains de façon continue. */
export function clipDepth(points: CameraPoint[]): CameraPoint[] {
  return clipPlane(clipPlane(points, NEAR, 1), FAR, -1);
}

/** Insère les intersections du polygone avec le plan de découpe. */
function clipPlane(points: CameraPoint[], depth: number, sign: number): CameraPoint[] {
  if (!points.length) return points;
  const clipped: CameraPoint[] = [];
  let before = points.at(-1)!;
  for (const after of points) {
    const inside = (after.depth - depth) * sign >= 0;
    if (inside !== ((before.depth - depth) * sign >= 0)) {
      const t = (depth - before.depth) / (after.depth - before.depth);
      clipped.push({ side: before.side + (after.side - before.side) * t,
        down: before.down + (after.down - before.down) * t, depth });
    }
    if (inside) clipped.push(after);
    before = after;
  }
  return clipped;
}

/** Ordonne les objets du plus éloigné au plus proche. */
export function farthestFirst(a: { depth: number }, b: { depth: number }): number {
  return b.depth - a.depth;
}

/** Coupe une ligne ouverte sans refermer son contour comme un polygone. */
export function clipLineDepth(a: CameraPoint, b: CameraPoint): [CameraPoint, CameraPoint] | null {
  const delta = b.depth - a.depth;
  if (delta === 0) return a.depth >= NEAR && a.depth <= FAR ? [a, b] : null;
  const near = (NEAR - a.depth) / delta, far = (FAR - a.depth) / delta;
  const first = Math.max(0, Math.min(near, far)), last = Math.min(1, Math.max(near, far));
  if (first > last) return null;
  const at = (t: number): CameraPoint => ({
    side: a.side + (b.side - a.side) * t,
    down: a.down + (b.down - a.down) * t,
    depth: Math.min(FAR, Math.max(NEAR, a.depth + delta * t)),
  });
  return [at(first), at(last)];
}
