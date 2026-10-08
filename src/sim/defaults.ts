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
 * Case B of docs/modules/m04-etch.md: RIE 200 W, 30 mTorr, 4.6 min through an 800 nm window, on
 * 3000 rpm resist (500 nm), i-line, dose ×1. Recipe inputs from the spec, not physical constants.
 */
export const DEFAULT_RECIPE: Recipe = {
  litho: { spinRpm: 3000, source: 'i', designNm: 800, dose: 1 },
  etch: { mode: 'dry', powerW: 200, pressureMTorr: 30, timeMin: 4.6 },
};
