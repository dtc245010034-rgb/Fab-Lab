/**
 * The etch half of `runRecipe` for a cross-section that somebody else built: M03's output goes in
 * here, so M04 etches what M03 printed. `runRecipe` itself is left alone (M04's path must not
 * move); tests/sim/etchFrom.test.ts holds the two to the same answer, bit for bit.
 */
import {
  arrivalTime,
  rieRates,
  wetEtchRates,
  type ArrivalField,
  type EtchRates,
} from '../physics/etch';
import { measureEtch, type CrossSection, type EtchMetrics } from './grid';
import { etchTimeMaxMin, type EtchStep } from './recipe';

export interface EtchOutcome {
  rates: EtchRates;
  field: ArrivalField;
  metrics: EtchMetrics;
  /** Wall-clock cost, for the same readouts as `RecipeResult.timingsMs`. Not part of the physics. */
  timingsMs: { arrival: number; total: number };
}

/** Throws RangeError if `etch.timeMin` is beyond `etchTimeMaxMin(etch)`, like `runRecipe`. */
export function runEtchOnSection(section: CrossSection, etch: EtchStep): EtchOutcome {
  const start = performance.now();
  const rates =
    etch.mode === 'wet'
      ? wetEtchRates(etch.etchant)
      : rieRates({ powerW: etch.powerW, pressureMTorr: etch.pressureMTorr });

  const arrivalStart = performance.now();
  const field = arrivalTime(section, rates, { maxTimeMin: etchTimeMaxMin(etch) });
  const arrivalMs = performance.now() - arrivalStart;

  const metrics = measureEtch(section, field, etch.timeMin);
  return {
    rates,
    field,
    metrics,
    timingsMs: { arrival: arrivalMs, total: performance.now() - start },
  };
}
