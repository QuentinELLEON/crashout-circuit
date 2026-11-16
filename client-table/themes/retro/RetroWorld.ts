/** Compose le monde Rétro à résolution fixe et le présente sous les interfaces de table. */
import type { GameState, Team } from '../../../server/types.js';
import { LOGICAL_H, LOGICAL_W } from '../../../server/layout.js';
import type { View } from '../../view.js';
import { RETRO } from '../../../client-shared/theme/retroPalette.js';
import { TrackLayer, type MapColors } from '../../../client-shared/raceMap/TrackLayer.js';
import { sceneryKey, type SceneryPresentation } from '../SceneryLayout.js';
import { paintRetroScenery } from './retroScenery.js';
import { RetroKarts } from './retroKarts.js';
import { drawRetroEffects, drawRetroObjects } from './retroObjects.js';

export const RETRO_TABLE_SIZE = { width: 480, height: 270 } as const;
const MAP: MapColors = { ground: RETRO.grass, road: RETRO.asphalt, roadAlt: RETRO.asphaltLight,
  edge: RETRO.white, kerb: RETRO.red, shadow: RETRO.shadow };

export class RetroWorld {
  private readonly world = canvas();
  private readonly scenery = canvas();
  readonly track = new TrackLayer(.25);
  private readonly karts = new RetroKarts();
  private background = '';
  private geometry: GameState['track'] = null;
  private sceneKey = 0;
  sceneryBuilds = 0;

  /** Affiche le décor fixe et le reconstruit à la création d'un nouveau circuit. */
  drawBackground(ctx: CanvasRenderingContext2D, state: GameState | null): void {
    const mode: SceneryPresentation = state?.phase === 'LOBBY' || !state ? 'lobby'
      : state.phase === 'MAP' ? 'map' : 'race';
    const track = mode === 'race' ? state?.track ?? null : null;
    if (track !== this.geometry) {
      this.geometry = track;
      this.sceneKey = sceneryKey(track);
    }
    const key = `${mode}.${this.sceneKey}`;
    if (key !== this.background) {
      const painter = this.scenery.getContext('2d')!;
      painter.save();
      painter.scale(.25, .25);
      paintRetroScenery(painter, track, mode);
      painter.restore();
      this.background = key;
      this.sceneryBuilds++;
    }
    blit(ctx, this.scenery);
  }

  /** Affiche le revêtement sans marquage final pendant la révélation. */
  drawTrack(ctx: CanvasRenderingContext2D, state: GameState, start = true): void {
    if (state.track) blit(ctx, this.track.get(state, MAP, start));
  }

  /** Dessine le monde mobile à basse résolution, avec les ombres et les sprites. */
  drawRace(ctx: CanvasRenderingContext2D, state: GameState, view: View, now: number, fallen: Set<Team>): void {
    const frame = this.world.getContext('2d')!;
    frame.clearRect(0, 0, this.world.width, this.world.height);
    frame.save();
    frame.imageSmoothingEnabled = false;
    frame.scale(.25, .25);
    this.drawTrack(frame, state);
    drawRetroObjects(frame, state, now, view.visualTime, view.reducedMotion);
    for (const car of Object.values(state.cars)) {
      if (!car.disabled) fallen.delete(car.team);
      if (car.disabled && view.effects.some(effect => effect.kind === 'fall' && effect.team === car.team)) {
        fallen.add(car.team);
      }
      if (!fallen.has(car.team)) this.karts.draw(frame, car);
    }
    drawRetroEffects(frame, view.effects, view.visualTime, view.reducedMotion);
    frame.restore();
    blit(ctx, this.world);
  }
}

/** Crée une surface logique dont les pixels restent stables au redimensionnement. */
function canvas(): HTMLCanvasElement {
  const element = document.createElement('canvas');
  element.width = RETRO_TABLE_SIZE.width;
  element.height = RETRO_TABLE_SIZE.height;
  return element;
}

/** Agrandit une surface sans interpolation et sans modifier la couche d'interface. */
function blit(ctx: CanvasRenderingContext2D, layer: HTMLCanvasElement): void {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(layer, 0, 0, LOGICAL_W, LOGICAL_H);
  ctx.restore();
}
