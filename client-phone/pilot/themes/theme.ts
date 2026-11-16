/** Décline les matériaux de la table dans les vues du pilote. */
import type { ThemeId } from '../../../server/types.js';
import { themeLook, THEMES } from '../../../client-shared/theme/looks.js';
import type { RoadColors } from '../views/projectedRoad.js';
import type { MapColors } from '../../../client-shared/raceMap/TrackLayer.js';

export type Motif = 'column' | 'pipes' | 'blocks' | 'stands' | 'tents';

export interface PilotTheme {
  id: ThemeId;
  sky: [string, string];
  ground: [string, string];
  road: RoadColors;
  map: MapColors;
  motif: Motif;
  accent: string;
  material: string;
  lights: string;
}

type ClassicPaletteId = Exclude<ThemeId, 'retro'>;
const motif: Record<ClassicPaletteId, Motif> = {
  neon: 'column', scrap: 'pipes', toy: 'blocks', classic: 'stands', mayhem: 'tents',
};
const terrain: Record<ClassicPaletteId, { sky: [string, string]; ground: [string, string]; road: [string, string] }> = {
  neon:    { sky: ['#050611', '#182544'], ground: ['#121d33', '#090e20'], road: ['#1a293d', '#24364e'] },
  scrap:   { sky: ['#20333d', '#8fa0a1'], ground: ['#677a79', '#253137'], road: ['#45545b', '#536168'] },
  toy:     { sky: ['#276c80', '#a7d4ce'], ground: ['#5e9d9b', '#17686d'], road: ['#164e60', '#236577'] },
  classic: { sky: ['#4a84b0', '#c4e3e9'], ground: ['#6c9876', '#355a48'], road: ['#343d42', '#424b4e'] },
  mayhem:  { sky: ['#4d3d44', '#c38b61'], ground: ['#8b6145', '#3c3029'], road: ['#684735', '#7a593f'] },
};

/** Construit la palette une fois, à partir du même thème que la table. */
function descriptor(id: ClassicPaletteId): PilotTheme {
  const look = themeLook(id);
  const preview = THEMES.find(theme => theme.id === id)!.colors;
  const colors = terrain[id];
  const edge: [string, string] = id === 'classic' ? [look.ink, preview[1]]
    : [look.ink, id === 'neon' ? preview[1] : look.accent];
  return {
    id, sky: colors.sky, ground: colors.ground, accent: look.accent, material: look.material,
    lights: look.electric, motif: motif[id],
    road: { road: colors.road, edge, fog: colors.ground[0], boost: look.accent },
    map: { ground: colors.ground[1], road: colors.road[0], edge: edge[0] },
  };
}

const descriptors = new Map<ThemeId, PilotTheme>(THEMES.flatMap(({ id }) => id === 'retro' ? [] : [[id, descriptor(id)] as const]));

/** Retombe sur Ferraille lorsqu'un serveur annonce une ambiance inconnue. */
export function pilotTheme(id: string | undefined): PilotTheme {
  return descriptors.get(id as ThemeId) ?? descriptors.get('scrap')!;
}
