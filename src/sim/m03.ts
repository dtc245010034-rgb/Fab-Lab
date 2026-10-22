/**
 * M03, lithography: the learner's session (what they chose and where they are), what it shows
 * (view), how it is judged (verdict) and what it hands to M04 (output). Pure functions over plain
 * data; the page keeps the session and changes it, the worker computes the view from it
 * (workers/simService.ts). Nothing here touches the DOM or React.
 *
 * Two ideas hold it together:
 *  - The picture follows the step, as in the prototype: step → stage (bare oxide, coated, exposed,
 *    developed). Parameters are live; there is no "run" button.
 *  - Redoing a layer is allowed until the etch begins. `rework` strips the resist (back to bare
 *    oxide) and the correction dialled for the mask becomes the one the next exposure uses;
 *    `commit` is the point of no return and freezes the session.
 */
import { dofNm } from '../physics/aerial';
import { constants } from '../physics/constants';
import {
  aerialProfile,
  exposeResist,
  type AerialProfile,
  type ExposureInput,
  type ExposureResult,
} from '../physics/exposure';
import { resistThicknessNm, type LithoFlag } from '../physics/litho';
import { Material } from '../physics/materials';
import {
  contactLanding,
  measurementSites,
  overlayErrorAt,
  overlayToleranceNm,
  overlayVerdict,
  worstOverlayNm,
  type Alignment,
  type Landing,
  type OverlayError,
  type OverlayVerdict,
  type Site,
} from '../physics/overlay';
import {
  processWindow,
  type ProcessWindow,
  type ProcessWindowSpec,
} from '../physics/processWindow';
import { DEFAULT_GRID_SPEC, DEFAULT_M03_RECIPE, M03_AERIAL, M03_SCENARIO } from './defaults';
import {
  buildGrid,
  type CrossSection,
  type GridLitho,
  type GridSpec,
  type LithoStage,
} from './grid';
import { LAST_STEP, NO_ALIGNMENT, stageOf, type M03Session } from './m03Session';
import { seededRandom } from './random';
import { processWindowSpecFor } from './windowSpec';

// The session functions that need no model live in m03Session.ts (the page uses them); the
// chart's axes in windowSpec.ts. Everything stays importable from here.
export {
  canCommit,
  canRework,
  commit,
  goToStep,
  M03_STEPS,
  rework,
  setPlan,
  setRecipe,
  stageOf,
  type M03Session,
  type M03Step,
} from './m03Session';
export { processWindowSpecFor };

/** What the verniers read at the measurement sites, and what that means for the contact. */
export interface OverlayReadout {
  /** hidden + applied: where the pattern on the wafer really sits against the first layer. */
  residual: Alignment;
  readings: { site: Site; error: OverlayError }[];
  worstNm: number;
  /** Index into `readings`. */
  worstIndex: number;
  /** The printed width the tolerance is a fraction of (the design width if nothing printed). */
  cdNm: number;
  toleranceNm: number;
  verdict: OverlayVerdict;
  /** Whether the contact window still falls on the region below it, at the worst site. */
  landing: Landing;
}

export type Grade = 'ok' | 'marginal' | 'fail';

/** Why a run is not "ok". The sentences for these live in src/content/vi/m03/. */
export type CauseCode =
  | 'below-resolution'
  | 'underbaked'
  | 'bridging'
  | 'underdose'
  | 'overdose'
  | 'scum'
  | 'near-resolution'
  | 'out-of-focus'
  | 'overbaked'
  | 'underdeveloped'
  | 'overdeveloped'
  | 'cd-off-size'
  | 'overlay';

export interface Cause {
  code: CauseCode;
  severity: 'fail' | 'marginal';
  /**
   * The size that goes with the cause, nm: the residue left (scum), the skin (bridging), the worst
   * overlay (overlay), and for `cd-off-size` the width at the foot minus the design, with its sign.
   */
  valueNm?: number;
  /** `cd-off-size` only: that deviation as a signed fraction of the design (−0.15 is 15% too narrow). */
  fraction?: number;
  /**
   * `cd-off-size` only: which way to turn the dose to bring the width back. The same for either
   * sign of the error only for a positive resist; for a negative one more light narrows the window,
   * so it is the other way round. Worked out here, where the polarity is known, not in the copy.
   */
  doseAdvice?: 'increase' | 'decrease';
}

/** Đạt / Biên / Hỏng, and the causes, failing ones first and each root cause before its effect. */
export interface M03Verdict {
  grade: Grade;
  causes: Cause[];
}

export interface M03View {
  step: number;
  stage: LithoStage;
  exposure: ExposureResult;
  section: CrossSection;
  overlay: OverlayReadout;
  verdict: M03Verdict;
  /** The light across the window and the dissolving levels: the graph of step 3.4. */
  aerial: AerialProfile;
}

/** What M04 starts from. */
export interface M03Output {
  /** The developed cross-section, with sealed cavities filled in (see `sealCavities`). */
  section: CrossSection;
  litho: GridLitho;
  exposure: ExposureResult;
  overlay: OverlayReadout;
  verdict: M03Verdict;
  reworks: number;
}

export type M03Request =
  | { kind: 'start'; seed: number; recipe?: ExposureInput }
  | { kind: 'view'; session: M03Session; spec?: GridSpec }
  | { kind: 'window'; recipe: ExposureInput; spec: ProcessWindowSpec };

export type M03Result =
  | { kind: 'start'; session: M03Session; timingsMs: { total: number } }
  | { kind: 'view'; view: M03View; timingsMs: { total: number } }
  | { kind: 'window'; window: ProcessWindow; timingsMs: { total: number } };

// --- the session --------------------------------------------------------------------------------

/** The overlay tolerance of the default window; the starting misplacement has to be outside it. */
let defaultToleranceNm: number | undefined;
const startTolerance = () =>
  (defaultToleranceNm ??= overlayToleranceNm(exposeResist(DEFAULT_M03_RECIPE).printedNm));

/** Far more than ever needed (23 of the first 1000 seeds reject their first draw, none a second); it only stops a bug from looping. */
const MAX_DRAWS = 1000;

/**
 * The hidden misplacement of the second mask for a seed: dx, dy and the rotation in this order,
 * each a sign (one draw) and a size between 0.4 and 1.0 of its range (one draw), so none is zero.
 * A draw whose worst overlay is within the tolerance of the default window is thrown away and the
 * next one taken from the same sequence, so the first reading of every exercise calls for a rework.
 */
export function scenarioMisalignment(seed: number): Alignment {
  const next = seededRandom(seed);
  const component = (range: number) => (next() < 0.5 ? -1 : 1) * (0.4 + 0.6 * next()) * range;
  const tolerance = startTolerance();
  for (let draw = 0; draw < MAX_DRAWS; draw++) {
    const misalignment: Alignment = {
      dxNm: component(M03_SCENARIO.shiftRangeNm),
      dyNm: component(M03_SCENARIO.shiftRangeNm),
      rotationUrad: component(M03_SCENARIO.rotationRangeUrad),
    };
    if (worstOverlayNm(misalignment) > tolerance) return misalignment;
  }
  throw new Error(`no starting misplacement outside the tolerance in ${MAX_DRAWS} draws`);
}

export function createSession(
  seed: number,
  recipe: ExposureInput = DEFAULT_M03_RECIPE,
): M03Session {
  return {
    seed,
    recipe,
    step: 0,
    hidden: scenarioMisalignment(seed),
    applied: NO_ALIGNMENT,
    plan: NO_ALIGNMENT,
    reworks: 0,
    committed: false,
  };
}

// --- from the physics to the grid ---------------------------------------------------------------

const GRID_FLAGS: readonly string[] = [
  'below-resolution',
  'near-resolution',
  'underdose',
  'overdose',
] satisfies LithoFlag[];

/**
 * The exposure result in the shape `buildGrid` reads. The skin is measured from the top of the film
 * as coated; overdevelopment takes the top off, so only what is left of it is drawn.
 */
export function toGridLitho(e: ExposureResult): GridLitho {
  const lostNm = resistThicknessNm(e.spinRpm) - e.resistThicknessNm;
  return {
    spinRpm: e.spinRpm,
    source: e.source,
    designNm: e.designNm,
    dose: e.dose,
    resistThicknessNm: e.resistThicknessNm,
    cdMinNm: e.cdMinNm,
    ratio: e.ratio,
    printedNm: e.printedNm,
    scumNm: e.scumNm,
    taperNm: e.taperNm,
    status: e.status,
    flags: e.flags.filter((f): f is LithoFlag => GRID_FLAGS.includes(f)),
    skinNm: Math.max(0, e.skinNm - lostNm),
  };
}

/**
 * Cavities that no air reaches (the hollow under the skin of a bridged window) are filled with
 * resist. `arrivalTime` starts the etch from every air cell, so a closed cavity left as air would
 * be etched from inside; the etchant cannot get in, and this keeps M04 free of a rule for it.
 * Air is connected through its four neighbours, from the top row. Returns the section as it came
 * when it has no such cavity.
 */
function sealCavities(section: CrossSection): CrossSection {
  const { materials, widthCells: w, heightCells: h } = section;
  const reached = new Uint8Array(materials.length);
  const stack: number[] = [];
  const visit = (i: number) => {
    if (materials[i] === Material.AIR && reached[i] === 0) {
      reached[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) visit(x);
  while (stack.length > 0) {
    const i = stack.pop()!;
    const x = i % w;
    if (x > 0) visit(i - 1);
    if (x < w - 1) visit(i + 1);
    if (i >= w) visit(i - w);
    if (i < w * (h - 1)) visit(i + w);
  }
  let sealed: Uint8Array | null = null;
  for (let i = 0; i < materials.length; i++) {
    if (materials[i] === Material.AIR && reached[i] === 0) {
      sealed ??= materials.slice();
      sealed[i] = Material.PR;
    }
  }
  return sealed ? { ...section, materials: sealed } : section;
}

// --- overlay ------------------------------------------------------------------------------------

/** What the verniers at the five sites read for the pattern on the wafer. */
export function readOverlay(s: M03Session, e: ExposureResult): OverlayReadout {
  const residual: Alignment = {
    dxNm: s.hidden.dxNm + s.applied.dxNm,
    dyNm: s.hidden.dyNm + s.applied.dyNm,
    rotationUrad: s.hidden.rotationUrad + s.applied.rotationUrad,
  };
  const readings = measurementSites().map((site) => ({
    site,
    error: overlayErrorAt(residual, site),
  }));
  let worstIndex = 0;
  readings.forEach((r, i) => {
    if (r.error.magnitudeNm > readings[worstIndex]!.error.magnitudeNm) worstIndex = i;
  });
  const worst = readings[worstIndex]!;
  const cdNm = e.printedNm > 0 ? e.printedNm : e.designNm;
  const toleranceNm = overlayToleranceNm(cdNm);
  return {
    residual,
    readings,
    worstNm: worst.error.magnitudeNm,
    worstIndex,
    cdNm,
    toleranceNm,
    verdict: overlayVerdict(worst.error.magnitudeNm, cdNm),
    landing: contactLanding({ windowNm: cdNm, offsetNm: worst.error.exNm, marginNm: toleranceNm }),
  };
}

// --- the verdict --------------------------------------------------------------------------------

/**
 * Đạt / Biên / Hỏng from the physics status and flags (and the overlay, when it has been read),
 * with the causes. No score: the M03 spec has no formula and none is invented here.
 *
 * The verdict says whether the **print is what was asked for**, exactly as the process-window chart
 * does: it is Đạt if and only if the chart would pass the sample (`passesProcessWindow`) and, when
 * the overlay is read, the overlay is Đạt. The physics `status` is a different question (does it
 * print clean: the 0.7 / 1.0 thresholds of the prototype) and is left as it is.
 *
 * Fail: anything standing between the etchant and the substrate (scum at the foot, a skin over
 * the top, or no window at all) thicker than the tolerance (`scumOkFraction` of the film), whether
 * or not the top is open. A wet oxide etchant does not attack resist, so even a thin layer stops
 * it completely. (For RIE a thin layer would only delay the etch, and a real fab strips such
 * residue with an O₂ descum; neither is modelled, so the verdict stays strict.) Also a resist that
 * was not baked enough.
 *
 * Marginal: a window clean to the foot whose width is off the design by more than the size
 * tolerance (`cd-off-size`, with the deviation and which way to turn the dose). There is no fail
 * threshold for the size: a real fab would call a big deviation a fail; the model does not grade it.
 *
 * Out of focus, an overbaked resist and a wrong develop time are not defects of the print: they
 * explain one. They are listed only when the print has a defect, so a print that comes out right
 * says nothing about how it was made.
 *
 * Order: failing causes first; then the roots (resolution, dose), the process causes that explain
 * them, and the effects (scum, size); the overlay last. Each cause that has a size keeps it in nm.
 */
export function judge(e: ExposureResult, overlay: OverlayReadout | null): M03Verdict {
  const tolerance = constants.litho.exposure.scumOkFraction.value;
  const sizeTolerance = constants.litho.exposure.cdToleranceFraction.value;
  const filmNm = resistThicknessNm(e.spinRpm);
  const blocked = e.blockedFraction > tolerance;
  const has = (flag: (typeof e.flags)[number]) => e.flags.includes(flag);
  const hasScum = e.scumNm > tolerance * filmNm;
  /** Clean to the foot, so the width at the foot means something, and not the size asked for. */
  const offSize = e.cleanToFoot && Math.abs(e.cdErrorFraction) > sizeTolerance;
  const atBlocking = blocked ? 'fail' : 'marginal';

  const printHasDefect =
    has('below-resolution') ||
    has('underbaked') ||
    has('bridging') ||
    has('underdose') ||
    has('overdose') ||
    has('near-resolution') ||
    hasScum ||
    offSize;

  const causes: Cause[] = [];
  const add = (code: CauseCode, severity: Cause['severity'], extra: Partial<Cause> = {}) =>
    causes.push({ code, severity, ...extra });

  if (has('below-resolution')) add('below-resolution', 'fail');
  if (has('underbaked')) add('underbaked', 'fail');
  if (has('bridging')) add('bridging', 'fail', { valueNm: e.skinNm });
  if (has('underdose')) add('underdose', atBlocking);
  if (has('overdose')) add('overdose', atBlocking);
  if (has('near-resolution')) add('near-resolution', atBlocking);
  if (printHasDefect) {
    if (has('out-of-focus')) add('out-of-focus', 'marginal');
    if (has('overbaked')) add('overbaked', 'marginal');
    if (has('underdeveloped')) add('underdeveloped', 'marginal');
    if (has('overdeveloped')) add('overdeveloped', 'marginal');
  }
  if (hasScum) add('scum', 'fail', { valueNm: e.scumNm });
  if (offSize) {
    const narrow = e.cdErrorFraction < 0;
    add('cd-off-size', 'marginal', {
      valueNm: e.printedNm - e.designNm,
      fraction: e.cdErrorFraction,
      // a positive window grows with the dose; a negative one (the window is the unexposed line) shrinks
      doseAdvice: narrow === (e.polarity === 'positive') ? 'increase' : 'decrease',
    });
  }
  if (overlay && overlay.verdict !== 'ok') {
    add('overlay', overlay.verdict === 'fail' ? 'fail' : 'marginal', { valueNm: overlay.worstNm });
  }

  // failing causes first, otherwise in the order above (Array.sort is stable)
  causes.sort((a, b) => Number(b.severity === 'fail') - Number(a.severity === 'fail'));
  const grade: Grade = causes.some((c) => c.severity === 'fail')
    ? 'fail'
    : causes.length > 0
      ? 'marginal'
      : 'ok';
  return { grade, causes };
}

// --- what is shown, and what is handed on -------------------------------------------------------

/** Everything the page draws for a session; the overlay counts in the verdict from the last step on. */
export function deriveView(s: M03Session, spec: GridSpec = DEFAULT_GRID_SPEC): M03View {
  const exposure = exposeResist(s.recipe);
  const stage = stageOf(s.step);
  const overlay = readOverlay(s, exposure);
  return {
    step: s.step,
    stage,
    exposure,
    section: buildGrid(spec, toGridLitho(exposure), stage),
    overlay,
    verdict: judge(exposure, s.step === LAST_STEP || s.committed ? overlay : null),
    aerial: aerialProfile(exposure, {
      samples: M03_AERIAL.samples,
      rangeDefocusNm: M03_AERIAL.rangeInDofs * dofNm(exposure.source),
    }),
  };
}

/** The cross-section and the verdict that M04 starts from. Needs a committed session. */
export function m03Output(s: M03Session, spec: GridSpec = DEFAULT_GRID_SPEC): M03Output {
  if (!s.committed) throw new Error('m03Output needs a committed session: the etch has not begun');
  const exposure = exposeResist(s.recipe);
  const litho = toGridLitho(exposure);
  const overlay = readOverlay(s, exposure);
  return {
    section: sealCavities(buildGrid(spec, litho, 'developed')),
    litho,
    exposure,
    overlay,
    verdict: judge(exposure, overlay),
    reworks: s.reworks,
  };
}

// --- the process-window chart and the worker ----------------------------------------------------

/** One request, as the worker runs it. Throws what the model throws (RangeError for a bad input). */
export function runM03Request(request: M03Request): M03Result {
  const start = performance.now();
  switch (request.kind) {
    case 'start': {
      const session = createSession(request.seed, request.recipe);
      return { kind: 'start', session, timingsMs: { total: performance.now() - start } };
    }
    case 'view': {
      const view = deriveView(request.session, request.spec);
      return { kind: 'view', view, timingsMs: { total: performance.now() - start } };
    }
    case 'window': {
      const window = processWindow(request.recipe, request.spec);
      return { kind: 'window', window, timingsMs: { total: performance.now() - start } };
    }
    default:
      throw new RangeError(
        `unknown M03 request kind "${String((request as { kind: unknown }).kind)}"`,
      );
  }
}
