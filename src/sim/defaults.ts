import type { GridSpec } from './grid';

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
