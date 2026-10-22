/**
 * Exposure and development of M03: aerial image → threshold → resist profile.
 * Pure functions, no DOM, no randomness. Model of docs/SCIENCE.md §2 M03; every coefficient is in
 * constants.ts (tier C). Returns numbers and flags only; the sentences live in src/content/.
 *
 * The model, in one paragraph. A clear slit of width `designNm` is blurred by a Gaussian of width
 * σ (aerial.ts). Light is absorbed on the way down, so at depth d the resist receives
 *   E(x, d) = D · I(x) · e^(−α·d),     D = dose × the bake's effect on sensitivity.
 * A positive resist dissolves where E ≥ E_th; a negative resist stays where E ≥ E_th (its mask is
 * the complement, so the window is the unexposed line: I → 1 − I). E_th is fixed by one rule:
 * dose ×1 prints a window much wider than the blur at its design width at the foot of the
 * reference-thickness film. Everything else follows:
 *   positive: the window is cleared down to d* = ln(D·I₀/E_th)/α, so a weak centre leaves scum
 *             at the foot, and the wall flares out at the top (more light up there);
 *   negative: the centre is cross-linked down to a depth d_skin, a bridge across the top, and the
 *             wall undercuts (less light at the foot).
 * Both walls are replaced by the straight line through the two ends of the cleared opening.
 *
 * Limits, to be said to the learner: a single slit has no hard resolution limit (a higher dose
 * opens a smaller window; the real limit is the diffraction of a line pattern at a given pitch,
 * which is not modelled); one Gaussian for the whole film (no change of focus across the
 * thickness, no standing waves); the resist responds as a step at E_th (infinite contrast).
 */
import { blurSigmaNm, dofNm, slitEdgeHalfWidthNm, slitIntensity } from './aerial';
import { constants, type LightSourceId } from './constants';
import { resistThicknessNm, type LithoFlag, type LithoStatus } from './litho';
import { erfinv } from './special';

const L = constants.litho;
const X = L.exposure;
const BAKE = L.bake;
const DEV = L.develop;

const ALPHA = X.absorptionPerNm.value;
/** E_th: dose ×1 prints the design width at the foot of the reference film (see the header). */
export const EXPOSURE_THRESHOLD = 0.5 * Math.exp(-ALPHA * L.resistRefThicknessNm.value);
/** Smallest opened height, nm, that still counts as an opening (below it the wall slope is noise). */
const MIN_OPEN_NM = 1e-6;
/** Develop time cannot thin the film all the way to nothing. */
const MAX_EROSION = 0.95;

export type Polarity = 'positive' | 'negative';

export interface SoftBake {
  /** Hot-plate temperature, °C. */
  tempC: number;
  /** Time on the hot plate, minutes. */
  timeMin: number;
}

export interface ExposureInput {
  spinRpm: number;
  source: LightSourceId;
  /** Width of the window the mask is meant to open, nm. The mask tone follows the resist. */
  designNm: number;
  /** Exposure dose relative to the standard dose (×). */
  dose: number;
  /** Focal plane position against the middle of the resist, nm; either sign, the model is symmetric. */
  defocusNm: number;
  polarity: Polarity;
  softBake: SoftBake;
  /** Develop time, minutes. */
  developMin: number;
}

export type ExposureFlag =
  | LithoFlag
  | 'out-of-focus'
  | 'underbaked'
  | 'overbaked'
  | 'underdeveloped'
  | 'overdeveloped'
  | 'bridging';

export interface ExposureResult extends ExposureInput {
  /** Resist left after development (the film is thinned by overdevelopment), nm. */
  resistThicknessNm: number;
  /** Smallest design that prints clean at dose ×1 and best focus on this resist film, nm. */
  cdMinNm: number;
  /** designNm / cdMinNm. */
  ratio: number;
  dofNm: number;
  /** Gaussian width of the aerial image at this focus, nm. */
  sigmaNm: number;
  /** The bake in minutes at the reference temperature. */
  bakeEquivalentMin: number;
  /** Dose × the bake's effect on sensitivity (×). */
  effectiveDose: number;
  /**
   * The window is open at the top surface of the resist: some of the film is cleared from the top
   * down, and for a negative resist no cross-linked skin (thicker than the residue tolerance)
   * covers it. False means nothing printed; a result that is false here is always a fail.
   */
  openAtTop: boolean;
  /**
   * The window is clean to the foot: the opening reaches the substrate with no more than the
   * tolerated residue (scum at the foot, skin at the top). Implies `openAtTop`. A window that is
   * open at the top but not clean to the foot has `printedNm = 0`, because the foot is blocked.
   */
  cleanToFoot: boolean;
  /** Window width at the foot of the resist, nm; 0 when nothing opens. What M04 etches through. */
  printedNm: number;
  /** Window width at the top of the opening, nm; 0 when nothing opens. */
  cdTopNm: number;
  /** Resist left at the foot of the window, nm. */
  scumNm: number;
  /** Cross-linked bridge over the top of a negative-resist window, nm. */
  skinNm: number;
  /** How far each wall flares out from the foot to the top of the resist, nm per side (< 0: undercut). */
  taperNm: number;
  /** Angle between the resist wall and the wafer, degrees; 90 = vertical, > 90 = undercut. */
  wallAngleDeg: number;
  /** (printedNm − designNm) / designNm. */
  cdErrorFraction: number;
  /** The share of the film that blocks the window (scum or skin), 0 to 1; 1 when nothing opens. */
  blockedFraction: number;
  status: LithoStatus;
  flags: ExposureFlag[];
}

function assertPositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number, got ${value}`);
  }
}

function assertNonNegative(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite number ≥ 0, got ${value}`);
  }
}

function assertBake(bake: SoftBake): void {
  if (!Number.isFinite(bake.tempC)) {
    throw new RangeError(`softBake.tempC must be a finite number, got ${bake.tempC}`);
  }
  assertNonNegative('softBake.timeMin', bake.timeMin);
}

/** The bake as minutes at the reference temperature: the time doubles for every `doublingC` °C. */
export function bakeEquivalentMin(bake: SoftBake): number {
  assertBake(bake);
  return bake.timeMin * Math.pow(2, (bake.tempC - BAKE.refTempC.value) / BAKE.doublingC.value);
}

/** Smallest design, nm, that prints clean (scum or skin within tolerance) at dose ×1, best focus. */
export function modelCdMinNm(source: LightSourceId, spinRpm: number, polarity: Polarity): number {
  const thicknessNm = resistThicknessNm(spinRpm);
  const sigma0 = blurSigmaNm(source, 0);
  const s = X.scumOkFraction.value;
  // The centre intensity I₀ that the window needs at dose ×1 (derivation in the header).
  let need: number;
  if (polarity === 'positive') {
    need = EXPOSURE_THRESHOLD * Math.exp(ALPHA * (1 - s) * thicknessNm);
  } else if (polarity === 'negative') {
    if (Math.exp(-ALPHA * thicknessNm) < EXPOSURE_THRESHOLD) return Infinity; // foot not cross-linked at ×1
    need = 1 - EXPOSURE_THRESHOLD * Math.exp(ALPHA * s * thicknessNm);
  } else {
    throw new RangeError(`unknown polarity "${String(polarity)}"`);
  }
  if (!(need < 1)) return Infinity; // the film is too thick for any slit to clear it at ×1
  return 2 * Math.SQRT2 * sigma0 * erfinv(Math.max(0, need));
}

interface Env {
  thicknessNm: number;
  sigmaNm: number;
  designNm: number;
  polarity: Polarity;
}

/** What one exposure + develop leaves, before it is judged. */
interface Core {
  /** An opening exists inside the film (the wall profile below is defined). */
  exists: boolean;
  openAtTop: boolean;
  cleanToFoot: boolean;
  printedNm: number;
  cdTopNm: number;
  scumNm: number;
  skinNm: number;
  taperNm: number;
  wallAngleDeg: number;
  cdErrorFraction: number;
  blockedFraction: number;
  remainingNm: number;
}

function evaluate(env: Env, effectiveDose: number, developMin: number): Core {
  const { thicknessNm: T, sigmaNm, designNm, polarity } = env;
  const D = effectiveDose;
  const devRef = DEV.refMin.value;
  const excessMin = Math.max(0, developMin - DEV.overdevelopAboveRel.value * devRef);
  const erosion = Math.min(MAX_EROSION, DEV.darkErosionFractionPerMin.value * excessMin);
  const remainingNm = T * (1 - erosion);
  const widenNm = DEV.wideningNmPerMin.value * excessMin;
  /** How deep the developer gets from the top in this time (not capped: every use takes min with T). */
  const devDepthNm = T * (developMin / devRef);

  const i0 = slitIntensity(0, designNm, sigmaNm);
  const edge = (level: number) => slitEdgeHalfWidthNm(level, designNm, sigmaNm);

  let exists = false;
  let skinNm = 0;
  let scumNm = 0;
  let d1 = 0; // depth of the top of the opening
  let d2 = 0; // depth of the bottom of the opening
  let x1 = 0; // half-width there
  let x2 = 0;

  if (polarity === 'positive') {
    const reach = D * i0 > EXPOSURE_THRESHOLD ? Math.log((D * i0) / EXPOSURE_THRESHOLD) / ALPHA : 0;
    const cleared = Math.max(0, Math.min(reach, T, devDepthNm));
    scumNm = T - cleared;
    if (cleared > MIN_OPEN_NM) {
      exists = true;
      d1 = 0;
      d2 = cleared;
      x1 = edge(EXPOSURE_THRESHOLD / D);
      x2 = edge((EXPOSURE_THRESHOLD * Math.exp(ALPHA * cleared)) / D);
    }
  } else {
    const levelAt = (depthNm: number) => 1 - (EXPOSURE_THRESHOLD * Math.exp(ALPHA * depthNm)) / D;
    const footCrossLinked = D * Math.exp(-ALPHA * T) >= EXPOSURE_THRESHOLD;
    const leak = D * (1 - i0);
    const bridge = leak > EXPOSURE_THRESHOLD ? Math.log(leak / EXPOSURE_THRESHOLD) / ALPHA : 0;
    const bottom = Math.min(T, devDepthNm);
    if (footCrossLinked) {
      skinNm = Math.min(bridge, T);
      scumNm = T - bottom;
      if (bottom - bridge > MIN_OPEN_NM) {
        exists = true;
        d1 = bridge;
        d2 = bottom;
        x1 = edge(levelAt(bridge));
        x2 = edge(levelAt(bottom));
      }
    }
  }

  const scumTolerance = X.scumOkFraction.value;
  if (!exists) {
    return {
      exists,
      openAtTop: false,
      cleanToFoot: false,
      printedNm: 0,
      cdTopNm: 0,
      scumNm: Math.min(remainingNm, scumNm),
      skinNm,
      taperNm: 0,
      wallAngleDeg: 90,
      cdErrorFraction: -1,
      blockedFraction: 1,
      remainingNm,
    };
  }

  const height = d2 - d1;
  const slope = (x2 - x1) / height; // half-width per nm of depth
  const halfAt = (depthNm: number) => x1 + slope * (depthNm - d1) + widenNm;
  const footHalf = Math.max(0, halfAt(T));
  const printedNm = 2 * footHalf;
  const blockedFraction = Math.max(scumNm, skinNm) / T;
  return {
    exists,
    openAtTop: skinNm <= scumTolerance * T,
    cleanToFoot: blockedFraction <= scumTolerance,
    printedNm,
    cdTopNm: 2 * (x1 + widenNm),
    scumNm: Math.min(remainingNm, scumNm),
    skinNm,
    taperNm: halfAt(T - remainingNm) - footHalf,
    wallAngleDeg: (Math.atan2(height, x1 - x2) * 180) / Math.PI,
    cdErrorFraction: (printedNm - designNm) / designNm,
    blockedFraction,
    remainingNm,
  };
}

export function exposeResist(input: ExposureInput): ExposureResult {
  const { spinRpm, source, designNm, dose, defocusNm, polarity, softBake, developMin } = input;
  assertPositive('designNm', designNm);
  assertPositive('dose', dose);
  assertNonNegative('developMin', developMin);
  if (polarity !== 'positive' && polarity !== 'negative') {
    throw new RangeError(`unknown polarity "${String(polarity)}"`);
  }

  const thicknessNm = resistThicknessNm(spinRpm); // validates spinRpm
  const sigmaNm = blurSigmaNm(source, defocusNm); // validates source and defocus
  const dof = dofNm(source);
  const bakeMin = bakeEquivalentMin(softBake); // validates the bake
  const overbakeMin = Math.max(0, bakeMin - BAKE.overbakeAboveMin.value);
  const effectiveDose = dose / (1 + BAKE.sensitivityLossPerMin.value * overbakeMin);

  const env: Env = { thicknessNm, sigmaNm, designNm, polarity };
  const actual = evaluate(env, effectiveDose, developMin);
  const cdMinNm = modelCdMinNm(source, spinRpm, polarity);

  // --- flags -----------------------------------------------------------------------------------
  const scumOk = X.scumOkFraction.value;
  const sizeTol = X.cdToleranceFraction.value;
  // What the same optics would give at the standard dose and the reference develop time: if that is
  // fine, the dose (not the optics) is to blame for a defect.
  const standard = evaluate(env, 1, DEV.refMin.value);
  const doseOff = effectiveDose !== 1;
  const doseFlag: ExposureFlag = effectiveDose < 1 ? 'underdose' : 'overdose';
  const flags: ExposureFlag[] = [];

  const bakeStuck = bakeMin < BAKE.underbakeBelowMin.value;
  if (!actual.exists) {
    if (!standard.exists) flags.push('below-resolution');
    else if (doseOff) flags.push(doseFlag);
  } else if (actual.blockedFraction > scumOk) {
    if (!standard.exists || standard.blockedFraction > scumOk) flags.push('near-resolution');
    else if (doseOff) flags.push(doseFlag);
  } else if (
    doseOff &&
    Math.abs(actual.cdErrorFraction) > sizeTol &&
    standard.exists &&
    Math.abs(standard.cdErrorFraction) <= sizeTol
  ) {
    flags.push(doseFlag);
  }
  if (polarity === 'negative' && actual.skinNm > scumOk * thicknessNm) flags.push('bridging');
  if (Math.abs(defocusNm) > dof / 2) flags.push('out-of-focus');
  if (bakeStuck) flags.push('underbaked');
  if (bakeMin > BAKE.overbakeAboveMin.value) flags.push('overbaked');
  if (developMin < DEV.refMin.value) flags.push('underdeveloped');
  if (developMin > DEV.overdevelopAboveRel.value * DEV.refMin.value) flags.push('overdeveloped');

  const status: LithoStatus =
    !actual.openAtTop || bakeStuck ? 'fail' : flags.length > 0 ? 'marginal' : 'ok';

  return {
    ...input,
    resistThicknessNm: Math.round(actual.remainingNm),
    cdMinNm,
    ratio: designNm / cdMinNm,
    dofNm: dof,
    sigmaNm,
    bakeEquivalentMin: bakeMin,
    effectiveDose,
    openAtTop: actual.openAtTop,
    cleanToFoot: actual.cleanToFoot,
    printedNm: actual.printedNm,
    cdTopNm: actual.cdTopNm,
    scumNm: actual.scumNm,
    skinNm: actual.skinNm,
    taperNm: actual.taperNm,
    wallAngleDeg: actual.wallAngleDeg,
    cdErrorFraction: actual.cdErrorFraction,
    blockedFraction: actual.blockedFraction,
    status,
    flags,
  };
}

// --- the aerial-image graph ---------------------------------------------------------------------

/** How far past the slit, in σ at the largest focus offset the graph shows, its axis reaches. */
const PROFILE_REACH_SIGMA = 3;

export interface AerialProfileOptions {
  /** Points on the x axis; odd, so that one of them is the centre of the window. */
  samples: number;
  /**
   * The largest focus offset the graph is meant to show, nm. The axis is cut to that blur and
   * stays put as the focus moves, so a bigger offset shows up as a wider curve, not a rescaled one.
   */
  rangeDefocusNm: number;
}

/**
 * What the graph of step 3.4 draws. The resist dissolves, at a depth d, where the light on it,
 * `dose · I(x) · e^(−α·d)`, reaches E_th (positive resist) or falls short of it (negative resist).
 * Dividing by the dose: it dissolves where I(x) is at or above `level(d) = E_th·e^(α·d)/dose` for a
 * positive resist, and where I(x) is below that level for a negative one. The level is lowest at
 * the top of the film and highest at the foot, which is why the window is wider at the top.
 */
export interface AerialProfile {
  /** nm from the centre of the window, evenly spaced, symmetric, including 0. */
  xNm: Float64Array;
  /** Relative light on the resist at the current focus, 0 to 1: the slit image, or its complement for a negative resist. */
  intensity: Float64Array;
  /** The same at best focus, for comparison. */
  bestFocusIntensity: Float64Array;
  designNm: number;
  polarity: Polarity;
  /** E_th over the effective dose: the level at the top of the film. */
  levelTop: number;
  /** The level at the foot of the film as coated (e^(α·thickness) higher). */
  levelFoot: number;
  /** Half-width, nm, where the curve crosses `levelTop`; 0 if it never reaches it, the model's widest if it never leaves it. */
  edgeTopNm: number;
  /** The same for `levelFoot`: half of the width at the foot when the opening is clean to it. */
  edgeFootNm: number;
}

/**
 * The aerial image, the two dissolving levels and where they cross, for an exposure already worked
 * out by `exposeResist`. Built from the same threshold and the same slit functions as that, so the
 * crossings are the window edges `exposeResist` reports (tests/physics/aerialProfile.test.ts).
 */
export function aerialProfile(
  result: ExposureResult,
  options: AerialProfileOptions,
): AerialProfile {
  const { samples, rangeDefocusNm } = options;
  if (!Number.isInteger(samples) || samples < 3 || samples % 2 === 0) {
    throw new RangeError(`samples must be an odd whole number ≥ 3, got ${samples}`);
  }
  if (!Number.isFinite(rangeDefocusNm) || rangeDefocusNm < 0) {
    throw new RangeError(`rangeDefocusNm must be a finite number ≥ 0, got ${rangeDefocusNm}`);
  }
  const { designNm, sigmaNm, polarity, source, effectiveDose } = result;
  const bestSigmaNm = blurSigmaNm(source, 0);
  const halfRangeNm = designNm / 2 + PROFILE_REACH_SIGMA * blurSigmaNm(source, rangeDefocusNm);
  const light = (x: number, sigma: number) => {
    const slit = slitIntensity(x, designNm, sigma);
    return polarity === 'positive' ? slit : 1 - slit;
  };

  const middle = (samples - 1) / 2;
  const xNm = new Float64Array(samples);
  const intensity = new Float64Array(samples);
  const bestFocusIntensity = new Float64Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = ((i - middle) / middle) * halfRangeNm;
    xNm[i] = x;
    intensity[i] = light(x, sigmaNm);
    bestFocusIntensity[i] = light(x, bestSigmaNm);
  }

  const levelTop = EXPOSURE_THRESHOLD / effectiveDose;
  const levelFoot = levelTop * Math.exp(ALPHA * resistThicknessNm(result.spinRpm));
  // the slit image reaches `level` for a positive resist; a negative one's light is 1 − the slit image
  const edge = (level: number) =>
    slitEdgeHalfWidthNm(polarity === 'positive' ? level : 1 - level, designNm, sigmaNm);
  return {
    xNm,
    intensity,
    bestFocusIntensity,
    designNm,
    polarity,
    levelTop,
    levelFoot,
    edgeTopNm: edge(levelTop),
    edgeFootNm: edge(levelFoot),
  };
}
