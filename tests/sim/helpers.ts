// Test-only glue: runs litho → grid → etch rates → arrival time → metrics the way a caller would.
import { arrivalTime, Material, rieRates, wetEtchRates } from '../../src/physics/etch';
import { printLitho, type LithoInput } from '../../src/physics/litho';
import { DEFAULT_GRID_SPEC } from '../../src/sim/defaults';
import { buildGrid, measureEtch, type GridSpec } from '../../src/sim/grid';

export type EtchStep =
  | { mode: 'wet'; etchant: 'boe10' | 'boe6' | 'hf49'; timeMin: number }
  | { mode: 'dry'; powerW: number; pressureMTorr: number; timeMin: number };

export interface Recipe {
  litho: LithoInput;
  etch: EtchStep;
}

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

export function simulate(recipe: Recipe, spec: GridSpec = DEFAULT_GRID_SPEC) {
  const litho = printLitho(recipe.litho);
  const section = buildGrid(spec, litho, 'developed');
  const rates =
    recipe.etch.mode === 'wet'
      ? wetEtchRates(recipe.etch.etchant)
      : rieRates({ powerW: recipe.etch.powerW, pressureMTorr: recipe.etch.pressureMTorr });
  const arrival = arrivalTime(section, rates);
  const metrics = measureEtch(section, arrival, recipe.etch.timeMin);
  return { litho, section, rates, arrival, metrics, timeMin: recipe.etch.timeMin };
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
