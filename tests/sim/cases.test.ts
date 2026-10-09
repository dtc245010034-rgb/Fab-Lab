/**
 * The three regression cases of docs/modules/m04-etch.md as data the worker (warm-up, `?bench=1`)
 * and the benchmark share. They must stay the rows of that table, not a nearby recipe.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_RECIPE } from '../../src/sim/defaults';
import { M04_CASES } from '../../src/sim/cases';
import { runRecipe } from '../../src/sim/recipe';
import { BASE_LITHO, rie, wet } from './helpers';

describe('M04_CASES', () => {
  it('lists A, B, C in the order of the table', () => {
    expect(M04_CASES.map((c) => c.id)).toEqual(['A', 'B', 'C']);
  });

  it('A: wet BOE 6:1, 3.3 min, 800 nm window', () => {
    expect(M04_CASES[0]!.recipe).toEqual({ litho: BASE_LITHO, etch: wet('boe6', 3.3) });
  });

  it('B: RIE 200 W, 30 mTorr, 4.6 min, 800 nm window, and it is the default recipe', () => {
    expect(M04_CASES[1]!.recipe).toEqual({ litho: BASE_LITHO, etch: rie(200, 30, 4.6) });
    expect(M04_CASES[1]!.recipe).toBe(DEFAULT_RECIPE);
  });

  it('C: RIE 80 W, 180 mTorr, 9 min, 400 nm window', () => {
    expect(M04_CASES[2]!.recipe).toEqual({
      litho: { ...BASE_LITHO, designNm: 400 },
      etch: rie(80, 180, 9),
    });
  });

  it.each(M04_CASES.map((c) => [c.id, c] as const))(
    'case %s breaks through to silicon',
    (_id, c) => {
      expect(runRecipe(c.recipe).metrics.cleared).toBe(true);
    },
  );
});
