/**
 * `runEtchOnSection` is the second half of `runRecipe`, for a cross-section that somebody else
 * built (M03's output). It must give exactly what `runRecipe` gives when it is handed the section
 * `runRecipe` would have built itself: the M04 path is not allowed to move.
 */
import { describe, expect, it } from 'vitest';
import { printLitho } from '../../src/physics/litho';
import { M04_CASES } from '../../src/sim/cases';
import { DEFAULT_GRID_SPEC } from '../../src/sim/defaults';
import { runEtchOnSection } from '../../src/sim/etchFrom';
import { buildGrid } from '../../src/sim/grid';
import { runRecipe } from '../../src/sim/recipe';

describe('runEtchOnSection', () => {
  it.each(M04_CASES)('gives, bit for bit, what runRecipe gives for case $id', ({ recipe }) => {
    const section = buildGrid(DEFAULT_GRID_SPEC, printLitho(recipe.litho), 'developed');
    const mine = runEtchOnSection(section, recipe.etch);
    const reference = runRecipe(recipe);

    expect(mine.rates).toEqual(reference.rates);
    expect(mine.field.maxTimeMin).toBe(reference.field.maxTimeMin);
    expect(mine.field.arrival.length).toBe(reference.field.arrival.length);
    for (let i = 0; i < mine.field.arrival.length; i++) {
      if (!Object.is(mine.field.arrival[i], reference.field.arrival[i])) {
        throw new Error(`arrival differs at cell ${i}`);
      }
    }
    expect(mine.metrics).toEqual(reference.metrics);
  });

  it('reports how long it took, the whole run at least as long as the search', () => {
    const { recipe } = M04_CASES[1]!;
    const section = buildGrid(DEFAULT_GRID_SPEC, printLitho(recipe.litho), 'developed');
    const { timingsMs } = runEtchOnSection(section, recipe.etch);
    expect(timingsMs.arrival).toBeGreaterThanOrEqual(0);
    expect(timingsMs.total).toBeGreaterThanOrEqual(timingsMs.arrival);
  });

  it('refuses an etch time beyond what the time control offers, as runRecipe does', () => {
    const { recipe } = M04_CASES[0]!;
    const section = buildGrid(DEFAULT_GRID_SPEC, printLitho(recipe.litho), 'developed');
    expect(() => runEtchOnSection(section, { mode: 'wet', etchant: 'boe6', timeMin: 9 })).toThrow(
      RangeError,
    );
  });
});
