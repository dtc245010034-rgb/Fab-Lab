import { DEFAULT_RECIPE, WARMUP_RUNS_PER_CASE } from './defaults';
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

/**
 * What the worker runs at idle after it starts: A, B, C, A, B, C, ... Round-robin, so every
 * round exercises the wet path and both RIE paths before any of them is repeated.
 */
export function warmUpRecipes(runsPerCase: number = WARMUP_RUNS_PER_CASE): Recipe[] {
  return Array.from({ length: runsPerCase }, () => M04_CASES.map((c) => c.recipe)).flat();
}
