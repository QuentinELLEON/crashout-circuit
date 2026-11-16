/** Décrit la réservation d'une place et les commandes propres aux téléphones. */
import type { BaseMsg } from './messageEnvelope.js';
import type { SeatId, Vec2 } from './gameState.js';
import type { TangibleId } from '../tangibles/tangibles.js';

/** Demande une place ou reprend une réservation existante. */
export interface JoinMsg extends BaseMsg {
  type: 'Join';
  room: string;
  seat?: SeatId;
  token?: string;
  name?: string;
}

/** Confirme une place et transmet son jeton à la seule connexion concernée. */
export interface JoinedMsg extends BaseMsg {
  type: 'Joined';
  seat: SeatId;
  token: string;
}

/** Explique pourquoi une demande de place a été refusée. */
export interface JoinRejectedMsg extends BaseMsg {
  type: 'JoinRejected';
  reason: 'seat-taken' | 'bad-token' | 'unknown-room' | 'room-full';
}

/** Demande de libérer son poste avant le départ. */
export interface LeaveMsg extends BaseMsg {
  type: 'Leave';
}

/** Confirme la libération du poste. */
export interface LeftMsg extends BaseMsg {
  type: 'Left';
}

/** Active la pose à distance pour le seul copilote qui la demande. */
export interface SetAccessibilityMsg extends BaseMsg {
  type: 'SetAccessibility';
  on: boolean;
}

/** Décrit ce que le joueur souhaite poser dans le repère de la table. */
export type PlacementTarget =
  | { kind: 'tangible'; id: TangibleId; pos: Vec2; angle: number }
  | { kind: 'boost'; pos: Vec2; width: number }
  | { kind: 'slingshot'; pos: Vec2 };

/** Demande de confirmer un aperçu après validation des mêmes contraintes que sur la table. */
export interface RemotePlaceMsg extends BaseMsg {
  type: 'RemotePlace';
  target: PlacementTarget;
  requestId: number;
}

/** Identifie le blocage précis d'une tentative de pose. */
export type PlacementFailure = 'disabled' | 'phase' | 'busy' | 'wrong-mode' | 'not-armed'
  | 'outside-table' | 'blocked-zone' | 'outside-track' | 'out-of-range' | 'invalid';

/** Indique à la seule connexion concernée le résultat d'une pose à distance. */
export type PlacementResultMsg = BaseMsg & { type: 'PlacementResult'; requestId: number }
  & ({ ok: true } | { ok: false; reason: PlacementFailure });
