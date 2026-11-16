/** Nomme les ambiances synchronisées dans l'état public de la séance. */
export const THEME_IDS = ['neon', 'scrap', 'toy', 'classic', 'mayhem', 'retro'] as const;
export type ThemeId = typeof THEME_IDS[number];

/** Vérifie la valeur reçue avant de changer l'ambiance de la séance. */
export function isThemeId(value: unknown): value is ThemeId {
  return THEME_IDS.some(id => id === value);
}
