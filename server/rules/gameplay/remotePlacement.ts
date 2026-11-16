/** Valide une pose accessible et la transmet aux mêmes règles que les contacts physiques. */
import type { PlacementFailure, PlacementTarget, SeatId } from '../../types.js';
import type { GameRules } from '../GameRules.js';
import { prepareRemotePlacement } from './remotePlacementGeometry.js';

/** Applique la pose autorisée par la place, ou renvoie son motif de refus. */
export function placeRemotely(rules: GameRules, seat: SeatId, target: PlacementTarget): PlacementFailure | null {
  if (!rules.state.seats[seat].accessible || !seat.endsWith('-copilot')) return 'disabled';
  const t = rules.now;
  const team = rules.state.repairPads[seat].team;
  rules.tickTangiblePlacement(t);
  const placement = prepareRemotePlacement(rules.state, team, target);
  if ('reason' in placement) return placement.reason;
  if (placement.kind === 'tangible') {
    const { id, a, b } = placement;
    rules.prepareTangiblePlacement(id, seat);
    const grant = rules.state.tangiblePlacement;
    if (!grant || grant.by !== seat) return 'wrong-mode';
    rules.onTangibleTouchPlaced({ type: 'TangibleTouchPlaced', id, a, b, token: grant.token, t });
    return rules.state.tangiblePlacement ? 'invalid' : null;
  }
  if (placement.kind === 'boost') {
    rules.onBoostGate({ type: 'BoostGate', t, team, a: placement.a, b: placement.b });
  } else {
    rules.onSlingshot({ type: 'Slingshot', t, team, anchor: placement.anchor, pouch: placement.pouch });
  }
  return null;
}
