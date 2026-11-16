/** Vérifie les conversions de pose et les refus du serveur pour le mode accessibilité. */
import assert from 'node:assert/strict';
import type { PlacementTarget, Team } from '../../server/types.js';
import { generatePreset } from '../../server/track/MapGenerator.js';
import { createInitialState } from '../../server/rules/GameRules.js';
import { prepareRemotePlacement } from '../../server/rules/gameplay/remotePlacementGeometry.js';
import { tangibleTouchPose } from '../../server/tangibles/tangibleTouch.js';
import { slingshotShot } from '../../server/geometry.js';
import { orientBoostGate } from '../../server/track/boostGeometry.js';
import { socketFixture } from '../network/socketFixture.js';

const state = createInitialState(), team: Team = 'A';
state.track = generatePreset();
state.phase = 'RACE';
state.wideTable = true;
state.tangiblePlacementMode = 'touch';
let accepted = 0;
/** Compare chaque conversion valide avec la géométrie utilisée par la table. */
function check(target: PlacementTarget): void {
  const result = prepareRemotePlacement(state, team, target);
  if ('reason' in result) return;
  accepted++;
  const p = state.params;
  switch (result.kind) {
    case 'tangible': {
      const pose = tangibleTouchPose(result.id === 1 ? 'wall' : 'pylon', result.a, result.b, p, [])!;
      assert.ok(pose);
      assert.ok(Math.hypot(pose.x * p.logicalWidth - target.pos.x, pose.y * p.logicalHeight - target.pos.y) < 1e-6);
      if (target.kind === 'tangible' && target.id === 1) {
        const angle = Math.abs(((pose.angle - target.angle + 270) % 180) - 90);
        assert.ok(angle < 1e-6);
      }
      break;
    }
    case 'boost': {
      const gate = orientBoostGate(result.a, result.b, state.track);
      assert.ok(Math.hypot((gate.a.x + gate.b.x) * .5 - target.pos.x,
        (gate.a.y + gate.b.y) * .5 - target.pos.y) < 1e-6);
      break;
    }
    case 'slingshot': {
      const shot = slingshotShot(result.anchor, result.pouch, p);
      assert.ok(shot.valid);
      assert.ok(Math.hypot(shot.target.x - target.pos.x, shot.target.y - target.pos.y) < 1e-5);
      break;
    }
  }
}

for (let i = 0; i < 210; i++) {
  const pos = state.track.centerline[(i * 53) % state.track.centerline.length];
  state.cars.A.itemArmed = true;
  state.cars.A.heldItem = 'boost';
  check({ kind: 'boost', pos, width: 110 + i % 13 * 20 });
  state.cars.A.heldItem = 'slingshot';
  check({ kind: 'slingshot', pos });
  check({ kind: 'tangible', id: 1, pos, angle: (i * 15) % 180 });
}
assert.ok(accepted > 200);
assert.deepEqual(prepareRemotePlacement(state, team, { kind: 'slingshot', pos: { x: 100, y: 1000 } }),
  { reason: 'out-of-range' });
assert.deepEqual(prepareRemotePlacement(state, team, { kind: 'tangible', id: 1, pos: { x: -2, y: 500 }, angle: 0 }),
  { reason: 'outside-table' });

const fixture = await socketFixture();
try {
  const { game, client } = fixture;
  const [pilot, copilot, table] = await Promise.all([client('player'), client('player'), client('table')]);
  pilot.send({ type: 'Join', seat: 'A-pilot' });
  copilot.send({ type: 'Join', seat: 'A-copilot' });
  await Promise.all([pilot.receive('Joined'), copilot.receive('Joined')]);
  game.rules.startRace(undefined, false);
  game.rules.setTangiblePlacementMode('touch');
  const target: PlacementTarget = { kind: 'tangible', id: 1, pos: { x: 900, y: 500 }, angle: 45 };
  const placement = { type: 'RemotePlace', requestId: 1, target };
  copilot.send(placement);
  const blocked = await copilot.receive('PlacementResult');
  assert.ok(!blocked.ok && blocked.reason === 'disabled');
  pilot.send({ type: 'SetAccessibility', on: true });
  pilot.send(placement);
  await pilot.flush();
  assert.equal(game.getState().seats['A-pilot'].accessible, undefined);
  assert.equal(game.getState().walls.length, 0);
  const since = copilot.messages.length;
  copilot.send({ type: 'SetAccessibility', on: true });
  copilot.send(placement);
  assert.equal((await copilot.receive('PlacementResult', since)).ok, true);
  assert.equal(game.getState().walls[0].angle, 45);
  assert.equal(game.getState().tangiblePlacement, null);
  const s = game.getState();
  s.cars.A.heldItem = 'boost';
  copilot.send({ type: 'Power' });
  await copilot.flush();
  const boost: PlacementTarget = { kind: 'boost', pos: s.track!.centerline[45], width: 130 };
  const beforeBoost = copilot.messages.length;
  copilot.send({ type: 'RemotePlace', requestId: 2, target: boost });
  const result = await copilot.receive('PlacementResult', beforeBoost);
  assert.equal(result.ok, true);
  assert.equal(s.boostGates.length, 1);
  assert.equal(s.cars.A.heldItem, null);
  assert.ok(table.messages.every(message => message.type !== 'PlacementResult'));
  console.log(`✓ Pose accessible : ${accepted} conversions vérifiées, droits, obstacle et bonus réseau`);
} finally {
  await fixture.close();
}
