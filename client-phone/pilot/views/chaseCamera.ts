/** Place la caméra de poursuite autour de la voiture et anticipe la courbe proche. */
import type { TrackGeometry } from '../../../server/types.js';
import type { CarPose } from '../../../client-shared/raceMap/objects2d.js';
import { nearestOnTrack, trackTangent } from '../../../server/geometry.js';
import { shorterAngle } from './raceFrames.js';
import type { Camera } from './projection.js';

const radians = Math.PI / 180;

/** Calcule une caméra toujours derrière la voiture, même en cas de dérapage. */
export function chaseCamera(pose: CarPose, previous: number, track: TrackGeometry | null, reduced: boolean): Camera {
  let angle = pose.angle;
  if (track && !reduced) {
    const next = nearestOnTrack(pose.pos, track).index + 5;
    const tangent = trackTangent(track, next % track.centerline.length);
    const shift = shorterAngle(angle, Math.atan2(tangent.y, tangent.x));
    angle += Math.max(-10 * radians, Math.min(10 * radians, shift)) * .65;
  }
  return {
    pos: { x: pose.pos.x - Math.cos(pose.angle) * 90, y: pose.pos.y - Math.sin(pose.angle) * 90 },
    heading: reduced ? pose.angle : previous + shorterAngle(previous, angle) * .12,
    height: 60,
    pitch: 12 * radians,
  };
}

/** Positionne la voiture du pilote dans le tiers inférieur pour qu'elle reste lisible. */
export function chaseCarY(height: number, projectedY: number): number {
  return Math.max(height * .72, Math.min(height * .93, projectedY));
}
