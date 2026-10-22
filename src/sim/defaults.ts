import type { ExposureInput } from '../physics/exposure';
import type { GridSpec } from './grid';
import type { Recipe } from './recipe';

/**
 * Simulation settings, not physics: how finely the cross-section is sampled. Nothing here is a
 * statement about the real process, so these values carry no tier (unlike src/physics/constants.ts).
 *
 * 260 × 150 cells at 10 nm is 2.6 µm × 1.5 µm, the grid of the prototype. The performance budget
 * in CLAUDE.md allows up to 400 × 250.
 */
export const DEFAULT_GRID_SPEC: GridSpec = {
  widthCells: 260,
  heightCells: 150,
  cellNm: 10,
  /** Row where the oxide starts; air (and resist, when coated) is above it, silicon below the oxide. */
  oxideTopRow: 80,
};

/**
 * Largest value of the etch-time control per recipe family, minutes. The arrival field is computed
 * up to this time so that dragging the control only moves the read-out threshold. Control ranges
 * of the prototype, not statements about the real process.
 */
export const ETCH_TIME_MAX_MIN = { boe: 8, hf49: 0.5, dry: 14 } as const;

/**
 * Tooling settings for the worker, not statements about the real process (no tier, like the grid).
 * The first calls of `runRecipe` in a fresh page are slower than the steady state, so the worker
 * runs each of cases A, B, C this many times at idle before the learner's first changes arrive.
 * Measured in docs/PROGRESS.md: by the 3rd or 4th call the cost has settled.
 */
export const WARMUP_RUNS_PER_CASE = 3;

/** How many times `?bench=1` runs each of cases A, B, C. */
export const BENCH_RUNS_PER_CASE = 30;

/**
 * Case B of docs/modules/m04-etch.md: RIE 200 W, 30 mTorr, 4.6 min through an 800 nm window, on
 * 3000 rpm resist (500 nm), i-line, dose ×1. Recipe inputs from the spec, not physical constants.
 */
export const DEFAULT_RECIPE: Recipe = {
  litho: { spinRpm: 3000, source: 'i', designNm: 800, dose: 1 },
  etch: { mode: 'dry', powerW: 200, pressureMTorr: 30, timeMin: 4.6 },
};

/**
 * The M03 start condition: the same 3000 rpm (500 nm) i-line, 800 nm window, dose ×1 as the M04
 * default, with the nominal soft bake (1 min at 90 °C), the nominal develop time (1 min), best
 * focus and a positive resist. Recipe inputs, not physical constants.
 */
export const DEFAULT_M03_RECIPE: ExposureInput = {
  spinRpm: 3000,
  source: 'i',
  designNm: 800,
  dose: 1,
  defocusNm: 0,
  polarity: 'positive',
  softBake: { tempC: 90, timeMin: 1 },
  developMin: 1,
};

/**
 * How far the second mask starts from the alignment marks of the first layer (step 3.7), before the
 * learner corrects it: each of dx, dy and the rotation is drawn from the seed with a size between
 * 0.4 and 1.0 of these ranges, either sign. A draw whose worst overlay is within the tolerance of
 * the default window is drawn again, so every exercise starts out of tolerance. A scenario setting
 * (how hard the exercise is), not a statement about a real stepper.
 */
export const M03_SCENARIO = { shiftRangeNm: 150, rotationRangeUrad: 2 } as const;

/** The process-window chart: dose range (×) and how many samples on each axis. */
export const M03_WINDOW = { doseMin: 0.7, doseMax: 1.3, steps: 25, focusInDofs: 1.5 } as const;

/**
 * The aerial-image graph: points on its axis (odd, one at the centre of the window) and how far
 * the axis reaches, in depths of focus, so that it stays put as the focus moves. Display settings,
 * not statements about the real process.
 */
export const M03_AERIAL = { samples: 121, rangeInDofs: 1 } as const;

/**
 * Ranges of the M03 controls: rpm and window width from the M04 prototype; the dose and the focus
 * span the process-window chart and step by one of its columns and one of its rows, so the point
 * that marks the current setting always lies on a sample of the chart (the focus is in DOF, which
 * the page turns into nm for the source chosen); the bake and develop ranges reach both the
 * defects the model flags and the nominal values. Control settings, not physical constants.
 */
export const M03_CONTROLS = {
  spinRpm: { min: 1500, max: 6000, step: 250 },
  designNm: { min: 150, max: 1200, step: 50 },
  dose: { min: M03_WINDOW.doseMin, max: M03_WINDOW.doseMax, step: 0.025 },
  defocusInDofs: { min: -M03_WINDOW.focusInDofs, max: M03_WINDOW.focusInDofs, step: 0.125 },
  softBakeTempC: { min: 60, max: 130, step: 5 },
  softBakeTimeMin: { min: 0.25, max: 5, step: 0.25 },
  developMin: { min: 0.25, max: 3, step: 0.05 },
} as const;

/** Untimed runs of the process window before `?bench=1` times it (the JIT warms up per thread). */
export const M03_BENCH_WARMUP_RUNS = 3;
