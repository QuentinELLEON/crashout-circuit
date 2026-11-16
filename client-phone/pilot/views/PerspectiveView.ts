/** Partage le rendu perspective entre la vue embarquée et la caméra de poursuite. */
import type { GameState, Team } from '../../../server/types.js';
import { CAR_COLORS, type CarPose } from '../../../client-shared/raceMap/objects2d.js';
import { Projection, type Camera } from './projection.js';
import { ProjectedRoad, type RoadColors } from './projectedRoad.js';
import { ProjectedObjects } from './projectedObjects.js';
import { shorterAngle } from './raceFrames.js';
import { chaseCamera, chaseCarY } from './chaseCamera.js';
import { drawChaseCar } from './chaseCar.js';

const ROAD: RoadColors = {
  road: ['#4c5258', '#565c60'], edge: ['#f3f4ef', '#d74543'], fog: '#738085', boost: '#ffc054',
};

export class PerspectiveView {
  private readonly road = new ProjectedRoad();
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
    drawSky(ctx, w, h, p.horizon - Math.tan(camera.pitch) * p.focal);
    if (state.track) this.road.draw(ctx, p, state.track, ROAD, slow);
    this.objects.draw(ctx, p, state, poses, own, now, ROAD.boost);
    if (this.mode === 'third') {
      const y = p.screen(p.local(pose.pos))?.y ?? h * .88;
      drawChaseCar(ctx, w, h, chaseCarY(h, y), CAR_COLORS[own], reduced ? 0 : steer,
        !reduced && !slow && car.boostUntil > now);
    } else {
      drawHood(ctx, w, h, CAR_COLORS[own]);
    }
  }

}

 /** Applique le lissage de cap de la caméra embarquée. */
function cockpitCamera(pose: CarPose, previous: number, reduced: boolean): Camera {
  return { pos: pose.pos, heading: reduced ? pose.angle : previous + shorterAngle(previous, pose.angle) * .2,
    height: 24, pitch: 0 };
}

/** Pose l'horizon et les deux dégradés qui donnent un repère au pilote. */
function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number, horizon: number): void {
  horizon = Math.max(0, Math.min(h, horizon));
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#35556d');
  sky.addColorStop(1, '#a5bcc1');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon + 1);
  const ground = ctx.createLinearGradient(0, horizon, 0, h);
  ground.addColorStop(0, ROAD.fog);
  ground.addColorStop(1, '#283d37');
  ctx.fillStyle = ground;
  ctx.fillRect(0, horizon, w, h - horizon);
}

/** Indique visuellement le centre de la voiture en bas de la vue subjective. */
function drawHood(ctx: CanvasRenderingContext2D, w: number, h: number, color: string): void {
  ctx.beginPath();
  ctx.moveTo(w * .13, h);
  ctx.quadraticCurveTo(w * .28, h * .89, w * .5, h * .91);
  ctx.quadraticCurveTo(w * .72, h * .89, w * .87, h);
  ctx.closePath();
  ctx.fillStyle = '#18242c';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, w * .007);
  ctx.stroke();
}
