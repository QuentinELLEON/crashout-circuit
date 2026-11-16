/** Joue une manche réseau avec la table et quatre places, puis vérifie reprise et pose. */
import assert from 'node:assert/strict';
import { SEAT_IDS } from '../../client-shared/seatLabels.js';
import { socketFixture, until } from './socketFixture.js';

const fixture = await socketFixture();
try {
  const { game, client } = fixture;
  const table = await client('table');
  const players = await Promise.all(SEAT_IDS.map(() => client('player')));
  for (const [index, player] of players.entries()) player.send({ type: 'Join', seat: SEAT_IDS[index] });
  const reservations = await Promise.all(players.map(player => player.receive('Joined')));
  const [pilot, copilot, , roseCopilot] = players;
  const s = game.getState();
  assert.ok(SEAT_IDS.every(seat => s.seats[seat].connected));
  table.send({ type: 'StartGame' });
  await table.flush();
  assert.equal(s.wideTable, true);
  game.rules.startRace(undefined, true); // La génération du tracé est vérifiée dans la suite dédiée.
  game.rules.setTangiblePlacementMode('touch');
  table.send({ type: 'BeginRace' });
  await table.flush();
  assert.equal(s.phase, 'RACE');

  game.physics.stop();
  const start = Date.now();
  s.sessionStartAt = start;
  const { pos: initialPosition, angle: initialAngle } = s.cars.A;
  pilot.send({ type: 'PilotInput', team: 'B', steer: .45, throttle: 1 });
  pilot.send({ type: 'Power', team: 'A', role: 'copilot' });
  s.cars.A.heldItem = 'boost';
  await pilot.flush();
  for (let i = 0; i < 12; i++) game.physics.step(start + i * (1000 / 60));
  assert.ok(Math.hypot(s.cars.A.pos.x - initialPosition.x, s.cars.A.pos.y - initialPosition.y) > 2);
  assert.ok(s.cars.A.angle > initialAngle);
  assert.equal(s.cars.A.itemArmed, false);
  assert.equal(game.rules.inputs.B.steer, 0);

  pilot.ws.terminate();
  await until(() => s.seats['A-pilot'].connected ? undefined : true, 'La place doit passer hors ligne');
  assert.deepEqual(game.rules.inputs.A, { steer: 0, throttle: 0 });
  const resumed = await client('player');
  resumed.send({ type: 'Join', token: reservations[0].token });
  assert.equal((await resumed.receive('Joined')).seat, 'A-pilot');
  assert.equal(s.phase, 'RACE');

  copilot.send({ type: 'TangiblePrepare', id: 1 });
  await copilot.flush();
  const grant = game.getState().tangiblePlacement!;
  assert.equal(grant.by, 'A-copilot');
  table.send({ type: 'TangibleTouchPlaced', id: 1, token: grant.token,
    a: { x: 900, y: 540 }, b: { x: 900, y: 620 } });
  await table.flush();
  assert.equal(s.walls[0]?.pos.x, 900);
  const target = { kind: 'tangible', id: 2, pos: { x: 1100, y: 570 }, angle: 0 };
  roseCopilot.send({ type: 'RemotePlace', target, requestId: 1 });
  const denied = await roseCopilot.receive('PlacementResult');
  assert.ok(!denied.ok && denied.reason === 'disabled');
  copilot.send({ type: 'SetAccessibility', on: true });
  copilot.send({ type: 'RemotePlace', target, requestId: 1 });
  assert.equal((await copilot.receive('PlacementResult')).ok, true);
  assert.equal(s.tangibles[2].status, 'placed');

  for (const view of [table, ...players, resumed]) {
    const snapshots = view.messages.filter(msg => msg.type === 'State');
    assert.ok(snapshots.length > 0);
    for (const snapshot of snapshots) {
      const data = JSON.stringify(snapshot);
      assert.ok(reservations.every(({ token }) => !data.includes(token)));
    }
  }
  console.log('✓ Partie à quatre téléphones : course, droits, reconnexion, pose table et pose accessible');
} finally {
  await fixture.close();
}
