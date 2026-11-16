/** Vérifie le cadrage de la carte, l'interpolation et l'invalidation du cache de piste. */
import assert from 'node:assert/strict';
import { toScreen, toWorld } from '../../client-shared/raceMap/camera2d.js';
import { TrackLayer } from '../../client-shared/raceMap/TrackLayer.js';
import { interpolateCar } from '../../client-phone/pilot/views/raceFrames.js';
import { createInitialState } from '../../server/rules/GameRules.js';
import { generatePreset } from '../../server/track/MapGenerator.js';

const camera = { center: { x: 100, y: 200 }, width: 300, height: 200, scale: 2, rotation: -Math.PI / 2 };
assert.deepEqual(toScreen(camera, camera.center), { x: 150, y: 100 });
assert.deepEqual(toScreen(camera, { x: 125, y: 200 }), { x: 150, y: 50 });
assert.deepEqual(toWorld(camera, { x: 150, y: 50 }), { x: 125, y: 200 });
const car = { pos: { x: 100, y: 100 }, angle: Math.PI - .1 };
const after = { pos: { x: 120, y: 110 }, angle: -Math.PI + .1 };
const frame = interpolateCar(car, after, .5);
assert.deepEqual(frame.pos, { x: 110, y: 105 });
assert.ok(Math.abs(frame.angle - Math.PI) < 1e-8);
assert.deepEqual(interpolateCar(car, { ...after, pos: { x: 700, y: 900 } }, .1).pos, { x: 700, y: 900 });

let builds = 0;
const ctx = new Proxy({}, { get: () => () => {}, set: () => true });
Object.defineProperty(globalThis, 'document', { value: {
  createElement: () => ({ getContext: () => { builds++; return ctx; } }),
} });
const layer = new TrackLayer();
const state = createInitialState();
state.track = generatePreset();
layer.get(state);
layer.get({ ...state });
assert.equal(builds, 1);
layer.get({ ...state, trackVersion: 1 });
assert.equal(builds, 2);
console.log('✓ Vue périphérique : cadrage, conversion, interpolation et cache de géométrie');

const { Projection, clipDepth, clipLineDepth, farthestFirst } = await import('../../client-phone/pilot/views/projection.js');
const camera3d = new Projection({ pos: { x: 0, y: 0 }, heading: 0, height: 24, pitch: 0 }, 160, 100, 90);
const close = camera3d.screen(camera3d.local({ x: 80, y: 16 }))!;
assert.ok(Math.abs(close.x - 96) < 1e-8 && Math.abs(close.y - 64) < 1e-8);
const far = camera3d.screen(camera3d.local({ x: 160, y: 16 }))!;
assert.ok(close.scale > far.scale);
assert.equal(camera3d.screen(camera3d.local({ x: -80, y: 0 })), null);
const line = clipLineDepth(camera3d.local({ x: -20, y: 0 }), camera3d.local({ x: 800, y: 0 }))!;
assert.deepEqual(line.map(p => p.depth), [20, 700]);
const quad = [camera3d.local({ x: 0, y: -40 }), camera3d.local({ x: 50, y: -40 }),
  camera3d.local({ x: 50, y: 40 }), camera3d.local({ x: 0, y: 40 })];
assert.deepEqual(clipDepth(quad).map(p => p.depth), [20, 50, 50, 20]);
assert.deepEqual([close, far].sort(farthestFirst).map(p => p.depth), [160, 80]);
console.log('✓ Première personne : perspective, limites de caméra et tri en profondeur');

const { chaseCamera, chaseCarY } = await import('../../client-phone/pilot/views/chaseCamera.js');
for (const heading of [0, Math.PI / 3, Math.PI, Math.PI * 1.7]) {
  const pos = { x: 50, y: 10 };
  const camera = chaseCamera({ pos, angle: heading }, heading, null, false);
  assert.ok(Math.abs((pos.x - camera.pos.x) * Math.cos(heading) + (pos.y - camera.pos.y) * Math.sin(heading) - 90) < 1e-8);
  const p = new Projection(camera, 320, 180);
  const y = chaseCarY(180, p.screen(p.local(pos))!.y);
  assert.ok(y > 120 && y < 180);
}
assert.ok(chaseCamera({ pos: { x: 0, y: 0 }, angle: .5 }, 0, null, false).heading < .1);
console.log('✓ Troisième personne : recul de la caméra, lissage et position de la voiture');
