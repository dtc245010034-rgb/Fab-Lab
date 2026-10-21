/**
 * Process window of M03: for each pair (dose, focus) on a grid, does the exposure print a clean,
 * on-size window? Pure functions. It is `exposeResist` evaluated over a grid, nothing more, so the
 * chart can never disagree with the single run shown beside it.
 *
 * "Passing" means: a window opens through the film, it carries no more than the tolerated
 * residue, and its width at the foot is within the size tolerance of the design.
 */
import { constants } from './constants';
import { exposeResist, type ExposureInput, type ExposureResult } from './exposure';

const { scumOkFraction, cdToleranceFraction } = constants.litho.exposure;

/** The two axes of the chart, sampled evenly with both ends included. */
export interface ProcessWindowSpec {
  /** Dose range (×). */
  doseMin: number;
  doseMax: number;
  doseSteps: number;
  /** Focus range, nm; either sign. */
  defocusMinNm: number;
  defocusMaxNm: number;
  defocusSteps: number;
}

export interface ProcessWindow {
  doses: Float64Array;
  defocusNm: Float64Array;
  /** Window width at the foot, nm, one per sample; row-major: index = iFocus · doseSteps + iDose. */
  cdNm: Float64Array;
  /** 1 where the sample passes, same indexing. */
  pass: Uint8Array;
  passCount: number;
}

/** A clean, on-size window: the test applied to every sample of the chart. */
export function passesProcessWindow(result: ExposureResult): boolean {
  return (
    result.status !== 'fail' &&
    result.open &&
    result.blockedFraction <= scumOkFraction.value &&
    Math.abs(result.cdErrorFraction) <= cdToleranceFraction.value
  );
}

function assertSteps(name: string, steps: number): void {
  if (!Number.isInteger(steps) || steps < 2) {
    throw new RangeError(`${name} must be a whole number ≥ 2, got ${steps}`);
  }
}

function assertRange(name: string, min: number, max: number): void {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
    throw new RangeError(`${name} needs finite min < max, got ${min} … ${max}`);
  }
}

function axis(min: number, max: number, steps: number): Float64Array {
  const out = new Float64Array(steps);
  for (let i = 0; i < steps; i++) out[i] = min + ((max - min) * i) / (steps - 1);
  return out;
}

/** The dose and focus of `base` are ignored: the grid supplies them. */
export function processWindow(base: ExposureInput, spec: ProcessWindowSpec): ProcessWindow {
  assertSteps('doseSteps', spec.doseSteps);
  assertSteps('defocusSteps', spec.defocusSteps);
  assertRange('dose', spec.doseMin, spec.doseMax);
  assertRange('defocusNm', spec.defocusMinNm, spec.defocusMaxNm);
  if (spec.doseMin <= 0) throw new RangeError(`doseMin must be > 0, got ${spec.doseMin}`);

  const doses = axis(spec.doseMin, spec.doseMax, spec.doseSteps);
  const defocusNm = axis(spec.defocusMinNm, spec.defocusMaxNm, spec.defocusSteps);
  const cdNm = new Float64Array(spec.doseSteps * spec.defocusSteps);
  const pass = new Uint8Array(cdNm.length);
  let passCount = 0;

  for (let iFocus = 0; iFocus < spec.defocusSteps; iFocus++) {
    for (let iDose = 0; iDose < spec.doseSteps; iDose++) {
      const result = exposeResist({
        ...base,
        dose: doses[iDose]!,
        defocusNm: defocusNm[iFocus]!,
      });
      const i = iFocus * spec.doseSteps + iDose;
      cdNm[i] = result.printedNm;
      if (passesProcessWindow(result)) {
        pass[i] = 1;
        passCount++;
      }
    }
  }
  return { doses, defocusNm, cdNm, pass, passCount };
}
