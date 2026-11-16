/** Vérifie le cache et les surfaces de rendu Rétro de la table. */
import assert from 'node:assert/strict';
import { RETRO } from '../../client-shared/theme/retroPalette.js';
import { RetroWorld, RETRO_TABLE_SIZE } from '../../client-table/themes/retro/RetroWorld.js';
import { kartFrame } from '../../client-table/themes/retro/retroKarts.js';
import { createInitialState } from '../../server/rules/GameRules.js';
import { generatePreset } from '../../server/track/MapGenerator.js';

const layers: { width: number; height: number }[] = [];
const ctx = new Proxy({}, { get: (_target, key) => key === 'drawImage'
  ? (canvas: HTMLCanvasElement) => layers.push({ width: canvas.width, height: canvas.height }) : () => {},
set: () => true }) as CanvasRenderingContext2D;
Object.defineProperty(globalThis, 'document', { value: {
  createElement: () => ({ width: 0, height: 0, getContext: () => ctx }),
} });
const world = new RetroWorld(), state = createInitialState();
state.phase = 'RACE';
state.track = generatePreset();
world.drawBackground(ctx, state);
world.drawTrack(ctx, state);
assert.deepEqual(layers, [RETRO_TABLE_SIZE, RETRO_TABLE_SIZE]);
assert.deepEqual(RETRO_TABLE_SIZE, { width: 480, height: 270 });
assert.equal(world.track.builds, 1);
assert.equal(world.sceneryBuilds, 1);
state.track = structuredClone(state.track);
state.trackVersion++;
world.drawBackground(ctx, state);
world.drawTrack(ctx, state);
assert.equal(world.sceneryBuilds, 1, 'une déformation conserve le décor de base');
assert.equal(world.track.builds, 2);
assert.ok(new Set(Object.values(RETRO)).size <= 32);
assert.equal(new Set(Array.from({ length: 64 }, (_, i) => kartFrame(i * Math.PI / 32))).size, 16);
console.log('✓ Table Rétro : 480 × 270, seize orientations et décor en cache');
