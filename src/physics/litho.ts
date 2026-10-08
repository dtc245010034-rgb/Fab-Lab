/**
 * Simplified lithography: spin-coated resist thickness, resolution limit, and what a positive
 * resist prints for a given window, dose and source. Pure functions, no DOM, no randomness.
 * Model of docs/SCIENCE.md §2 M03; every coefficient is in constants.ts (tier C).
 *
 * This returns numbers and flags only. The sentences shown to learners live in src/content/.
 */
import { constants, type LightSourceId } from './constants';

export type { LightSourceId };

const L = constants.litho;

/** 'fail': nothing opens. 'marginal': prints, but with a visible defect. 'ok': clean. */
export type LithoStatus = 'ok' | 'marginal' | 'fail';

export type LithoFlag = 'below-resolution' | 'near-resolution' | 'underdose' | 'overdose';

export interface LithoInput {
  spinRpm: number;
  source: LightSourceId;
  /** Window width on the mask, nm. */
  designNm: number;
  /** Exposure dose relative to the standard dose (×). */
  dose: number;
}

export interface LithoResult extends LithoInput {
  resistThicknessNm: number;
  /** Resolution limit CD_min = k₁·λ/NA of the chosen source, nm. */
  cdMinNm: number;
  /** designNm / cdMinNm. */
  ratio: number;
  /** Window width actually opened in the resist, nm (0 when nothing opens). */
  printedNm: number;
  /** Resist left at the bottom of the window, nm. */
  scumNm: number;
  /** How much the window wall flares outwards from the bottom to the top of the resist, nm. */
  taperNm: number;
  status: LithoStatus;
  flags: LithoFlag[];
}

function assertPositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number, got ${value}`);
  }
}

/** Spin-coat thickness, t ∝ ω^-1/2 (empirical law, tier B in SCIENCE.md), rounded to whole nm. */
export function resistThicknessNm(spinRpm: number): number {
  assertPositive('spinRpm', spinRpm);
  return Math.round(L.resistRefThicknessNm.value * Math.sqrt(L.resistRefSpinRpm.value / spinRpm));
}

/** Resolution limit CD_min = k₁·λ/NA, nm. */
export function minFeatureNm(source: LightSourceId): number {
  const s = L.sources[source];
  return (L.k1.value * s.wavelengthNm.value) / s.na.value;
}

export function printLitho(input: LithoInput): LithoResult {
  const { spinRpm, source, designNm, dose } = input;
  assertPositive('designNm', designNm);
  assertPositive('dose', dose);

  const resistNm = resistThicknessNm(spinRpm);
  const cdMinNm = minFeatureNm(source);
  const ratio = designNm / cdMinNm;
  const band = L.resolutionMarginalBelowRatio.value - L.resolutionFailBelowRatio.value;

  let printedNm = designNm + L.doseWideningNmPerDose.value * (dose - 1);
  let scumNm = 0;
  let status: LithoStatus = 'ok';
  const flags: LithoFlag[] = [];

  if (ratio < L.resolutionFailBelowRatio.value) {
    printedNm = 0;
    scumNm = resistNm;
    status = 'fail';
    flags.push('below-resolution');
  } else if (ratio < L.resolutionMarginalBelowRatio.value) {
    printedNm *=
      L.marginalPrintedFractionAtFail.value +
      (L.marginalPrintedFractionGain.value * (ratio - L.resolutionFailBelowRatio.value)) / band;
    scumNm =
      (resistNm *
        L.marginalScumFractionAtFail.value *
        (L.resolutionMarginalBelowRatio.value - ratio)) /
      band;
    status = 'marginal';
    flags.push('near-resolution');
  }

  if (dose < L.underdoseBelowDose.value && printedNm > 0) {
    scumNm +=
      (resistNm * L.underdoseScumFractionPerSpan.value * (L.underdoseBelowDose.value - dose)) /
      L.underdoseDoseSpan.value;
    if (status !== 'fail') status = 'marginal';
    flags.push('underdose');
  }
  if (dose > L.overdoseAboveDose.value && printedNm > 0) {
    if (status !== 'fail') status = 'marginal';
    flags.push('overdose');
  }

  const taperNm =
    ratio < L.taperBelowRatio.value
      ? (L.taperBelowRatio.value - ratio) * L.taperNmPerRatio.value
      : 0;

  return {
    ...input,
    resistThicknessNm: resistNm,
    cdMinNm,
    ratio,
    printedNm: Math.max(0, printedNm),
    scumNm: Math.min(resistNm, scumNm),
    taperNm,
    status,
    flags,
  };
}
