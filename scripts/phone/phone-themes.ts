/** Vérifie les palettes, la stabilité des décors et les droits sur le thème de la séance. */
import assert from 'node:assert/strict';
import { THEMES } from '../../client-shared/theme/looks.js';
import { RETRO } from '../../client-shared/theme/retroPalette.js';
import { RETRO_PHONE_SIZE } from '../../client-phone/pilot/themes/retroBackdrop.js';
import { THEME_IDS } from '../../server/protocol/theme.js';
import { generatePreset } from '../../server/track/MapGenerator.js';
import { isInsideTrackRibbon } from '../../server/geometry.js';
import { pilotTheme } from '../../client-phone/pilot/themes/theme.js';
import { generateSceneDecor } from '../../client-phone/pilot/themes/sceneDecor.js';
import { socketFixture, until } from '../network/socketFixture.js';

assert.deepEqual(THEMES.map(({ id }) => id), [...THEME_IDS]);
assert.equal(pilotTheme('inconnu').id, 'scrap');
assert.equal(pilotTheme(undefined).id, 'scrap');
const track = generatePreset();
for (const { id } of THEMES) {
  const theme = pilotTheme(id);
  assert.equal(theme.id, id);
  assert.ok(theme.sky.every(Boolean) && theme.ground.every(Boolean) && theme.road.edge.every(Boolean) && theme.motif);
}
const decor = generateSceneDecor(track, 42, 75);
assert.ok(decor.length > 8);
assert.deepEqual(generateSceneDecor(track, 42, 75), decor);
assert.notDeepEqual(generateSceneDecor(track, 43, 75), decor);
assert.ok(decor.every(entry => !isInsideTrackRibbon(entry.pos, track, -75)));

assert.deepEqual(RETRO_PHONE_SIZE, { width: 320, height: 180 });
const retro = pilotTheme('retro');
assert.deepEqual(retro.road.edge, [RETRO.white, RETRO.red]);
assert.equal(retro.map.road, RETRO.asphalt);
assert.equal(retro.road.pixelated, true);

const fixture = await socketFixture();
try {
  const { game, client } = fixture;
  const [table, player] = await Promise.all([client('table'), client('player')]);
  assert.equal(game.getState().theme, 'scrap');
  player.send({ type: 'Join', seat: 'A-pilot' });
  await player.receive('Joined');
  player.send({ type: 'SetTheme', theme: 'toy' });
  await player.flush();
  assert.equal(game.getState().theme, 'scrap');
  table.send({ type: 'SetTheme', theme: 'inconnu' });
  await table.flush();
  assert.equal(game.getState().theme, 'scrap');
  table.send({ type: 'SetTheme', theme: 'retro' });
  await until(() => player.messages.find(msg => msg.type === 'State' && msg.state.theme === 'retro'),
    'Le téléphone doit recevoir le nouveau thème');
  assert.equal(game.getState().seats['A-pilot'].connected, true);
  console.log('✓ Thèmes des téléphones : palettes complètes, décors et synchronisation à chaud');
} finally {
  await fixture.close();
}
