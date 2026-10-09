// Test helpers: recipe constructors and a thin wrapper over the production `runRecipe`.
// There is deliberately no second copy of the litho → grid → arrival → metrics pipeline here.
import { arrivalTime } from '../../src/physics/etch';
import { Material } from '../../src/physics/materials';
import type { LithoInput } from '../../src/physics/litho';
import { DEFAULT_GRID_SPEC } from '../../src/sim/defaults';
import type { GridSpec } from '../../src/sim/grid';
import { runRecipe, type EtchStep, type Recipe } from '../../src/sim/recipe';

export type { EtchStep, Recipe };

/** Start condition of M04: 3000 rpm (500 nm resist), i-line, 800 nm window, dose ×1. */
export const BASE_LITHO: LithoInput = { spinRpm: 3000, source: 'i', designNm: 800, dose: 1 };

export const wet = (etchant: 'boe10' | 'boe6' | 'hf49', timeMin: number): EtchStep => ({
  mode: 'wet',
  etchant,
  timeMin,
});
export const rie = (powerW: number, pressureMTorr: number, timeMin: number): EtchStep => ({
  mode: 'dry',
  powerW,
  pressureMTorr,
  timeMin,
});

/**
 * `runRecipe` plus the two fields the tests read most. The arrival field is the one production
 * gets: searched up to the largest time the time control offers (`etchTimeMaxMin`), so a recipe
 * whose time is beyond that throws RangeError, as it does in the app.
 */
export function simulate(recipe: Recipe, spec: GridSpec = DEFAULT_GRID_SPEC) {
  const result = runRecipe(recipe, spec);
  return { ...result, arrival: result.field.arrival, timeMin: recipe.etch.timeMin };
}

/**
 * The plain search over the whole grid, with no `maxTimeMin`. Production never does this; it is
 * the reference the prototype parity checks compare against.
 */
export function unboundedArrival(sim: ReturnType<typeof simulate>): Float64Array {
  return arrivalTime(sim.section, sim.rates).arrival;
}

/** Depth etched into the oxide straight below the window centre, nm (a whole number of cells). */
export function centreDepthNm(sim: ReturnType<typeof simulate>): number {
  const { section, arrival, timeMin } = sim;
  const x = Math.floor(section.widthCells / 2);
  let rows = 0;
  for (let y = section.oxideTopRow; y < section.siTopRow; y++) {
    const i = y * section.widthCells + x;
    if (section.materials[i] === Material.AIR || arrival[i]! > timeMin) break;
    rows++;
  }
  return rows * section.cellNm;
}
