/**
 * Définit les cinq ambiances, leurs couleurs et la préférence locale de thème conservée pour les outils de
 * développement.
 * Référencé notamment par client-table/themes/circuit/CircuitMaterials.ts, client-table/themes/circuit/CircuitTrack.ts,
 * client-table/ui/HUD.ts.
 */
import type { ThemeId } from '../../server/types.js';
import { THEMES } from '../../client-shared/theme/looks.js';
export { THEMES, themeLook } from '../../client-shared/theme/looks.js';
export type { ThemeId } from '../../server/types.js';

/** Distingue les trois thèmes qui utilisent le même moteur de chaussée et de décor. */
export type CircuitTheme = Exclude<ThemeId, 'neon' | 'scrap' | 'retro'>;
export const THEME_STORAGE_KEY = 'crashout.visual-theme.v2';
/** Retrouve un identifiant de thème valide et choisit Ferraille en cas de valeur inconnue. */
export function themeId(value: unknown): ThemeId { return THEMES.find(/* Retrouve la définition dont l’identifiant correspond à la préférence enregistrée. */ t => t.id === value)?.id ?? 'scrap'; }
/** Lit la préférence visuelle locale en tolérant un stockage absent ou inaccessible. */
export function loadTheme(storage: Pick<Storage, 'getItem'>): ThemeId {
  try { return themeId(storage.getItem(THEME_STORAGE_KEY)); } catch { return 'scrap'; }
}
/** Conserve le thème choisi localement sans bloquer le jeu si le stockage est refusé. */
export function saveTheme(storage: Pick<Storage, 'setItem'>, id: ThemeId): void {
  try { storage.setItem(THEME_STORAGE_KEY, id); } catch { /* Still usable when storage is unavailable. */ }
}
