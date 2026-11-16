/** Partage le rendu perspective entre la vue embarquée et la caméra de poursuite. */
import type { GameState, Team } from '../../../server/types.js';
import { CAR_COLORS, type CarPose } from '../../../client-shared/raceMap/objects2d.js';
import { Projection, type Camera } from './projection.js';
import { ProjectedRoad } from './projectedRoad.js';
import { ProjectedObjects } from './projectedObjects.js';
import { shorterAngle } from './raceFrames.js';
import { chaseCamera, chaseCarY } from './chaseCamera.js';
import { drawChaseCar } from './chaseCar.js';

import { pilotTheme, type PilotTheme } from '../themes/theme.js';
import { drawRetroBackdrop } from '../themes/retroBackdrop.js';
import { drawRetroSprite } from '../themes/retroSprites.js';
import { SceneDecor } from '../themes/sceneDecor.js';

export class PerspectiveView {
  private readonly road = new ProjectedRoad();
  private readonly decor = new SceneDecor();
  private readonly objects = new ProjectedObjects();
  private heading: number | null = null;

  constructor(private readonly mode: 'first' | 'third') {}

  /** Construit la caméra puis dessine la route, les obstacles et la voiture suivie. */
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, state: GameState,
    poses: Record<Team, CarPose>, own: Team, now: number, reduced: boolean, slow: boolean, steer = 0): void {
    const pose = poses[own], car = state.cars[own];
    const previous = this.heading ?? pose.angle;
    const camera = this.mode === 'third'
      ? chaseCamera(pose, previous, state.track, reduced)
      : cockpitCamera(pose, previous, reduced);
    this.heading = camera.heading;
    const fov = 70 * (reduced || this.mode === 'third' ? 1 : 1 + Math.min(.1, car.speed / 3000));
    const p = new Projection(camera, w, h, fov);
    const theme = pilotTheme(state.theme);
    const horizon = p.horizon - Math.tan(camera.pitch) * p.focal;
    const pixelated = theme.id === 'retro';
    if (pixelated) drawRetroBackdrop(ctx, w, h, horizon, camera.heading, reduced || slow ? 0 : (now / 160) % 22);
    else drawSky(ctx, w, h, horizon, theme);
    if (state.track) {
      this.road.draw(ctx, p, state.track, theme.road, slow,
        pixelated && !slow && !reduced && car.speed > 30 ? Math.floor(now / 240) % 2 : 0);
      this.decor.draw(ctx, p, state.track, state.trackVersion, state.params.trackDeformMaxShiftPx + 20,
        theme, slow, reduced || slow ? 0 : now);
    }
    this.objects.draw(ctx, p, state, poses, own, now, theme);
    if (this.mode === 'third') {
      const y = p.screen(p.local(pose.pos))?.y ?? h * .88;
      const base = chaseCarY(h, y);
      if (pixelated) drawRetroSprite(ctx, 'car', w / 2, base, w * .23, h * .25, CAR_COLORS[own], reduced ? 0 : steer);
      else drawChaseCar(ctx, w, h, base, CAR_COLORS[own], reduced ? 0 : steer,
        !reduced && !slow && car.boostUntil > now, theme);
    } else {
      drawHood(ctx, w, h, CAR_COLORS[own], theme);
    }
  }

}

/** Applique le lissage de cap de la caméra embarquée. */
function cockpitCamera(pose: CarPose, previous: number, reduced: boolean): Camera {
  return { pos: pose.pos, heading: reduced ? pose.angle : previous + shorterAngle(previous, pose.angle) * .2,
    height: 24, pitch: 0 };
}

/** Pose l'horizon et les deux dégradés qui donnent un repère au pilote. */
function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number, horizon: number, theme: PilotTheme): void {
  horizon = Math.max(0, Math.min(h, horizon));
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, theme.sky[0]);
  sky.addColorStop(1, theme.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon + 1);
  const ground = ctx.createLinearGradient(0, horizon, 0, h);
  ground.addColorStop(0, theme.ground[0]);
  ground.addColorStop(1, theme.ground[1]);
  ctx.fillStyle = ground;
  ctx.fillRect(0, horizon, w, h - horizon);
}

/** Indique visuellement le centre de la voiture en bas de la vue subjective. */
function drawHood(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, theme: PilotTheme): void {
  ctx.beginPath();
  ctx.moveTo(w * .13, h);
  ctx.quadraticCurveTo(w * .28, h * .89, w * .5, h * .91);
  ctx.quadraticCurveTo(w * .72, h * .89, w * .87, h);
  ctx.closePath();
  ctx.fillStyle = theme.material;
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, w * .007);
  ctx.stroke();
  ctx.fillStyle = theme.lights;
  ctx.fillRect(w * .46, h * .953, w * .08, h * .012);
}
