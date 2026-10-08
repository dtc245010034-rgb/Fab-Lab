/**
 * One run of the M04 start condition through a recipe: lithography → grid → etch rates → arrival
 * time → metrics. This is what the Viewer calls on the main thread today and what the worker
 * (S0.4) will expose; nothing here touches the DOM or React.
 */
import type { WetEtchantId } from '../physics/constants';
import {
  arrivalTime,
  rieRates,
  wetEtchRates,
  type ArrivalField,
  type EtchRates,
} from '../physics/etch';
import { printLitho, type LithoInput, type LithoResult } from '../physics/litho';
import { DEFAULT_GRID_SPEC, ETCH_TIME_MAX_MIN } from './defaults';
import { buildGrid, measureEtch, type CrossSection, type EtchMetrics, type GridSpec } from './grid';

export type EtchStep =
  | { mode: 'wet'; etchant: WetEtchantId; timeMin: number }
  | { mode: 'dry'; powerW: number; pressureMTorr: number; timeMin: number };

export interface Recipe {
  litho: LithoInput;
  etch: EtchStep;
}

export interface RecipeResult {
  litho: LithoResult;
  section: CrossSection;
  rates: EtchRates;
  field: ArrivalField;
  metrics: EtchMetrics;
  /** Wall-clock cost of this run, for the `?debug=1` readout. Not part of the physics result. */
  timingsMs: {
    /** Only the shortest-path search (`arrivalTime`). */
    arrival: number;
    /** The whole run: litho, grid, rates, arrival time and metrics. */
    total: number;
  };
}

/**
 * Largest etch time the time control offers for this step. The arrival field is computed up to
 * this time, so dragging the time control never needs a recompute (see `ArrivalOptions`).
 */
export function etchTimeMaxMin(step: EtchStep): number {
  if (step.mode === 'dry') return ETCH_TIME_MAX_MIN.dry;
  return step.etchant === 'hf49' ? ETCH_TIME_MAX_MIN.hf49 : ETCH_TIME_MAX_MIN.boe;
}

/** Throws RangeError if `etch.timeMin` is beyond `etchTimeMaxMin(etch)`. */
export function runRecipe(recipe: Recipe, spec: GridSpec = DEFAULT_GRID_SPEC): RecipeResult {
  const start = performance.now();
  const { etch } = recipe;
  const litho = printLitho(recipe.litho);
  const section = buildGrid(spec, litho, 'developed');
  const rates =
    etch.mode === 'wet'
      ? wetEtchRates(etch.etchant)
      : rieRates({ powerW: etch.powerW, pressureMTorr: etch.pressureMTorr });

  const arrivalStart = performance.now();
  const field = arrivalTime(section, rates, { maxTimeMin: etchTimeMaxMin(etch) });
  const arrivalMs = performance.now() - arrivalStart;

  const metrics = measureEtch(section, field, etch.timeMin);
  return {
    litho,
    section,
    rates,
    field,
    metrics,
    timingsMs: { arrival: arrivalMs, total: performance.now() - start },
  };
}
