/** Transforme la pose choisie sur téléphone en gestes compatibles avec les règles de table. */
import type { GameState, GameParams, PlacementFailure, PlacementTarget, Team, Vec2 } from '../../types.js';
import { insidePanel, inTangibleDepot, panelOf, type PanelLayout } from '../../layout.js';
import { tablePanels } from '../../tableStations.js';
import { isInsideTrackRibbon, nearestOnTrack, slingshotShot, trackTangent } from '../../geometry.js';
import { BOOST_MIN_WIDTH, orientBoostGate } from '../../track/boostGeometry.js';
import { tangibleDefinition, type TangibleId } from '../../tangibles/tangibles.js';
import { tangibleTouchPose } from '../../tangibles/tangibleTouch.js';
import { armedPickup } from '../armedPickup.js';

export type PreparedPlacement = { reason: PlacementFailure }
  | { kind: 'tangible'; id: TangibleId; a: Vec2; b: Vec2 }
  | { kind: 'boost'; a: Vec2; b: Vec2 }
  | { kind: 'slingshot'; anchor: Vec2; pouch: Vec2; power: number };

/** Valide la demande, puis reconstruit les deux points nécessaires au geste demandé. */
export function prepareRemotePlacement(state: GameState, team: Team, target: PlacementTarget): PreparedPlacement {
  if (state.phase !== 'RACE' || !state.track) return { reason: 'phase' };
  if (state.tangiblePlacement) return { reason: 'busy' };
  if (!target || !inTable(target.pos, state.params)) return { reason: 'outside-table' };
  const panels = tablePanels(state), { pos } = target;
  if (insidePanel(pos, 0, panels)) return { reason: 'blocked-zone' };

  if (target.kind === 'tangible') return prepareTangible(state, target, panels);
  if (target.kind !== 'slingshot' && target.kind !== 'boost') return { reason: 'invalid' };
  if (armedPickup(state)?.kind !== target.kind) return { reason: 'not-armed' };

  if (target.kind === 'slingshot') return prepareShot(state, team, pos, panels);
  return prepareBoost(state, pos, target.width, panels);
}

/** Convertit une pose d'objet en prise à deux doigts. */
function prepareTangible(state: GameState, target: Extract<PlacementTarget, { kind: 'tangible' }>,
  panels: PanelLayout[]): PreparedPlacement {
  if (state.tangiblePlacementMode !== 'touch') return { reason: 'wrong-mode' };
  const definition = tangibleDefinition(target.id);
  if (!definition || !Number.isFinite(target.angle)) return { reason: 'invalid' };
  const axis = (target.angle - 90) * Math.PI / 180;
  const [a, b] = opposing(target.pos, { x: Math.cos(axis), y: Math.sin(axis) }, 60 * state.params.pylonBasePx / 32);
  if (!inTable(a, state.params) || !inTable(b, state.params)) return { reason: 'outside-table' };
  if ([a, b].some(p => insidePanel(p, 0, panels))) return { reason: 'blocked-zone' };
  return tangibleTouchPose(definition.kind, a, b, state.params, panels)
    ? { kind: 'tangible', id: target.id, a, b } : { reason: 'blocked-zone' };
}

/** Oriente les contacts de boost selon la branche la plus proche, comme sur la table. */
function prepareBoost(state: GameState, pos: Vec2, width: number, panels: PanelLayout[]): PreparedPlacement {
  const track = state.track!, params = state.params;
  if (!Number.isFinite(width) || width < Math.max(BOOST_MIN_WIDTH, params.boostLenMinPx)
    || width > params.boostLenMaxPx) return { reason: 'invalid' };
  if (!isInsideTrackRibbon(pos, track, 0)) return { reason: 'outside-track' };
  const tangent = trackTangent(track, nearestOnTrack(pos, track).index);
  const [a, b] = opposing(pos, { x: -tangent.y, y: tangent.x }, width);
  const pose = orientBoostGate(a, b, track);
  if (![a, b, pose.a, pose.b].every(p => inTable(p, params))) return { reason: 'outside-table' };
  if ([a, b, pose.a, pose.b].some(p => insidePanel(p, 0, panels) || inTangibleDepot(p))) {
    return { reason: 'blocked-zone' };
  }
  return { kind: 'boost', a, b };
}

/** Retrouve la traction nécessaire pour atteindre un point à partir du poste du copilote. */
function prepareShot(state: GameState, team: Team, pos: Vec2, panels: PanelLayout[]): PreparedPlacement {
  const panel = panelOf(team, 'copilot'), p = state.params;
  const pouch = { x: panel.cx, y: panel.cy };
  const dx = pos.x - pouch.x, dy = pos.y - pouch.y;
  const distance = Math.hypot(dx, dy);
  const min = p.slingMinPullPx + p.slingMinRangePx, max = p.slingMaxPullPx + p.slingMaxRangePx;
  if (distance < min || distance > max || max <= min) return { reason: 'out-of-range' };
  const power = (distance - min) / (max - min);
  const pull = Math.max(p.slingMinPullPx + 1e-7, p.slingMinPullPx + (p.slingMaxPullPx - p.slingMinPullPx) * power);
  const anchor = { x: pouch.x + dx * pull / distance, y: pouch.y + dy * pull / distance };
  if (insidePanel(anchor, 0, panels) || inTangibleDepot(anchor)) return { reason: 'blocked-zone' };
  const shot = slingshotShot(anchor, pouch, p);
  if (!shot.valid || Math.hypot(shot.target.x - pos.x, shot.target.y - pos.y) > .01) return { reason: 'out-of-range' };
  return { kind: 'slingshot', anchor, pouch, power };
}

/** Écarte les coordonnées invalides et tout point qui déborde de la table. */
function inTable(point: Vec2 | undefined, params: GameParams): point is Vec2 {
  return !!point && Number.isFinite(point.x) && Number.isFinite(point.y)
    && point.x >= 0 && point.y >= 0 && point.x <= params.logicalWidth && point.y <= params.logicalHeight;
}

/** Place deux contacts de part et d'autre d'un centre. */
function opposing(pos: Vec2, axis: Vec2, length: number): [Vec2, Vec2] {
  const dx = axis.x * length / 2, dy = axis.y * length / 2;
  return [{ x: pos.x - dx, y: pos.y - dy }, { x: pos.x + dx, y: pos.y + dy }];
}
