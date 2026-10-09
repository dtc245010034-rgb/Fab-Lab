/**
 * Cross-section grid of the M04 start condition (Si + SiO₂ + patterned resist) and the numbers
 * read off it after an etch. Row-major, row 0 at the top, x across; the window is centred.
 *
 * Layers are built from the physics results (litho, constants) and a GridSpec; nothing here
 * touches the DOM or React, so it can run in the worker.
 */
import { constants } from '../physics/constants';
import type { ArrivalField, MaterialGrid } from '../physics/etch';
import { Material } from '../physics/materials';
import type { LithoResult } from '../physics/litho';

const { AIR, SI, OX, PR } = Material;

/** Sampling of the cross-section; see defaults.ts. */
export interface GridSpec {
  widthCells: number;
  heightCells: number;
  /** Side of one cell, nm. */
  cellNm: number;
  /** Row where the oxide starts. */
  oxideTopRow: number;
}

/**
 * How far the lithography has got: bare oxide, resist coated, resist exposed (latent image), or
 * developed (exposed resist dissolved, window open).
 */
export type LithoStage = 'ox' | 'resist' | 'exposed' | 'developed';

export interface CrossSection extends MaterialGrid {
  /** 1 where resist is exposed but not yet developed away ("stage exposed" only), else 0. */
  readonly latent: Uint8Array;
  readonly oxideTopRow: number;
  /** First silicon row (= the row just below the oxide). */
  readonly siTopRow: number;
  /** Resist thickness in rows. */
  readonly resistRows: number;
  /** The lithography result this grid was built from. */
  readonly litho: LithoResult;
}

function assertSpec(spec: GridSpec): void {
  const { widthCells, heightCells, cellNm, oxideTopRow } = spec;
  if (
    !Number.isInteger(widthCells) ||
    widthCells <= 0 ||
    !Number.isInteger(heightCells) ||
    heightCells <= 0
  ) {
    throw new RangeError(
      `grid size must be positive whole cells, got ${widthCells} × ${heightCells}`,
    );
  }
  if (!Number.isFinite(cellNm) || cellNm <= 0) {
    throw new RangeError(`cellNm must be a positive finite number, got ${cellNm}`);
  }
  if (!Number.isInteger(oxideTopRow) || oxideTopRow < 0) {
    throw new RangeError(`oxideTopRow must be a whole number ≥ 0, got ${oxideTopRow}`);
  }
}

export function buildGrid(spec: GridSpec, litho: LithoResult, stage: LithoStage): CrossSection {
  assertSpec(spec);
  const { widthCells: w, heightCells: h, cellNm, oxideTopRow } = spec;

  const oxideRows = Math.round(constants.geometry.oxideThicknessNm.value / cellNm);
  const siTopRow = oxideTopRow + oxideRows;
  if (siTopRow >= h) {
    throw new RangeError(
      `oxide ends at row ${siTopRow}, which leaves no silicon in a ${h}-row grid`,
    );
  }
  const resistRows = Math.round(litho.resistThicknessNm / cellNm);
  if (stage !== 'ox' && resistRows > oxideTopRow) {
    throw new RangeError(
      `resist needs ${resistRows} rows but only ${oxideTopRow} lie above the oxide`,
    );
  }

  const materials = new Uint8Array(w * h);
  const latent = new Uint8Array(w * h);
  const centreX = w / 2;
  const scumRows = Math.round(litho.scumNm / cellNm);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let m: number = AIR;
      if (y >= siTopRow) {
        m = SI;
      } else if (y >= oxideTopRow) {
        m = OX;
      } else if (stage !== 'ox' && y >= oxideTopRow - resistRows) {
        m = PR;
        if (stage === 'exposed' || stage === 'developed') {
          const k = oxideTopRow - 1 - y; // 0 at the bottom of the resist
          const halfWindowCells =
            (litho.printedNm / 2 + (litho.taperNm * k) / Math.max(1, resistRows)) / cellNm;
          const inWindow = Math.abs(x + 0.5 - centreX) < halfWindowCells;
          if (inWindow && k >= scumRows) {
            if (stage === 'developed') m = AIR;
            else latent[i] = 1;
          }
        }
      }
      materials[i] = m;
    }
  }
  return {
    materials,
    latent,
    widthCells: w,
    heightCells: h,
    cellNm,
    oxideTopRow,
    siTopRow,
    resistRows,
    litho,
  };
}

export interface EtchMetrics {
  /** Window width the resist opened to, nm (from the litho result). */
  printedNm: number;
  /** The etch has gone through the oxide to silicon along the window centre. */
  cleared: boolean;
  /** Opening width at the top of the oxide, nm. */
  topNm: number;
  /** Opening width at the bottom of the oxide, nm; 0 if not cleared. */
  bottomNm: number;
  /** Sideways etch under the resist edge, nm per side. */
  undercutNm: number;
  /** Deepest silicon etched, nm. */
  siLossNm: number;
  /** Least resist left over the field (away from the window), nm. */
  resistLeftNm: number;
  /** Wall angle against the wafer surface, degrees; 90 = vertical; 0 if not cleared. */
  sidewallAngleDeg: number;
}

/**
 * Reads the etch result at `timeMin` from the arrival field of `arrivalTime()`. Dragging the time
 * only changes `timeMin`; the field is not recomputed. Throws RangeError if `timeMin` is beyond
 * `field.maxTimeMin`: the field holds Infinity for cells that arrive later than that, so reading it
 * would under-report the etch without any sign of it.
 */
export function measureEtch(
  section: CrossSection,
  field: ArrivalField,
  timeMin: number,
): EtchMetrics {
  const {
    materials,
    widthCells: w,
    heightCells: h,
    cellNm,
    oxideTopRow,
    siTopRow,
    litho,
  } = section;
  const { arrival, maxTimeMin } = field;
  if (arrival.length !== materials.length) {
    throw new RangeError(`arrival has ${arrival.length} cells, grid has ${materials.length}`);
  }
  if (!Number.isFinite(timeMin) || timeMin < 0) {
    throw new RangeError(`timeMin must be a finite number ≥ 0, got ${timeMin}`);
  }
  if (timeMin > maxTimeMin) {
    throw new RangeError(
      `timeMin ${timeMin} is beyond maxTimeMin ${maxTimeMin} that the arrival field was computed for; ` +
        'recompute it with a larger maxTimeMin',
    );
  }

  const cx = Math.floor(w / 2);
  const etched = (i: number) => materials[i] !== AIR && arrival[i]! <= timeMin;
  const open = (i: number) => etched(i) || materials[i] === AIR;

  let cleared = true;
  for (let y = oxideTopRow; y < siTopRow; y++) {
    if (!etched(y * w + cx)) {
      cleared = false;
      break;
    }
  }

  /** Width of the connected opening that contains the centre column, in cells. */
  const openingCells = (row: number): number => {
    const c = row * w + cx;
    if (!etched(c) && materials[c] !== AIR) return 0;
    let a = cx;
    let b = cx;
    while (a > 0 && open(row * w + a - 1)) a--;
    while (b < w - 1 && open(row * w + b + 1)) b++;
    return b - a + 1;
  };

  const topNm = openingCells(oxideTopRow) * cellNm;
  const bottomNm = cleared ? openingCells(siTopRow - 1) * cellNm : 0;
  const undercutNm = Math.max(0, (topNm - litho.printedNm) / 2);

  let siLossCells = 0;
  for (let x = 0; x < w; x++) {
    let depth = 0;
    for (let y = siTopRow; y < h && etched(y * w + x); y++) depth++;
    siLossCells = Math.max(siLossCells, depth);
  }

  const fieldStartNm =
    litho.printedNm / 2 + undercutNm + constants.geometry.resistMeasureMarginNm.value;
  let fewestResistCells = Infinity;
  for (let x = 0; x < w; x++) {
    if (Math.abs(x - cx) * cellNm < fieldStartNm) continue;
    let count = 0;
    for (let y = 0; y < oxideTopRow; y++) {
      const i = y * w + x;
      if (materials[i] === PR && !etched(i)) count++;
    }
    fewestResistCells = Math.min(fewestResistCells, count);
  }

  const oxideNm = (siTopRow - oxideTopRow) * cellNm;
  return {
    printedNm: litho.printedNm,
    cleared,
    topNm,
    bottomNm,
    undercutNm,
    siLossNm: siLossCells * cellNm,
    resistLeftNm: fewestResistCells === Infinity ? 0 : fewestResistCells * cellNm,
    sidewallAngleDeg: cleared
      ? (Math.atan2(oxideNm, Math.max(0, (topNm - bottomNm) / 2)) * 180) / Math.PI
      : 0,
  };
}
