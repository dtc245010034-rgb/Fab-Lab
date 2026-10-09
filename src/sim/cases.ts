import { DEFAULT_RECIPE } from './defaults';
import type { Recipe } from './recipe';

/**
 * The three regression cases of docs/modules/m04-etch.md. The worker warms up on them and
 * `?bench=1` times them, so both exercise the wet path, the straight RIE path and the sloped,
 * undercut RIE path. Recipe inputs from the spec, not physical constants.
 */
export interface M04Case {
  id: 'A' | 'B' | 'C';
  recipe: Recipe;
}

/** Litho shared by all three: 3000 rpm (500 nm resist), i-line, dose ×1; only the window differs. */
const litho = (designNm: number) => ({ spinRpm: 3000, source: 'i', designNm, dose: 1 }) as const;

export const M04_CASES: readonly M04Case[] = [
  { id: 'A', recipe: { litho: litho(800), etch: { mode: 'wet', etchant: 'boe6', timeMin: 3.3 } } },
  { id: 'B', recipe: DEFAULT_RECIPE },
  {
    id: 'C',
    recipe: {
      litho: litho(400),
      etch: { mode: 'dry', powerW: 80, pressureMTorr: 180, timeMin: 9 },
    },
  },
];
