/**
 * Etch model of docs/SCIENCE.md §2 M04: how fast each material is etched (wet and RIE) and the
 * moment the etch front reaches every cell of a 2-D cross-section.
 *
 * The front is propagated by a shortest-path search (Dijkstra) from every air cell. A step into a
 * cell costs the time to etch across it, which depends on the material (via selectivity) and on
 * the direction (vertical vs lateral rate). This is a geometric simplification: it does not model
 * ion transport or surface chemistry, and the UI must say so.
 *
 * Pure functions, no DOM, no randomness. Rates come from constants.ts (tier C, illustrative).
 * Units: nm, minutes, W, mTorr.
 */
import { constants, type WetEtchantId } from './constants';

/** Material codes stored in a grid's `materials` array. (A const object: `enum` is not allowed.) */
export const Material = { AIR: 0, SI: 1, OX: 2, PR: 3 } as const;
export type MaterialCode = (typeof Material)[keyof typeof Material];

// Local copies: the hot loops below must not go through the `Material` object on every cell.
const { AIR, SI, OX, PR } = Material;

/** What the shortest-path search needs from a cross-section; row-major, row 0 at the top. */
export interface MaterialGrid {
  readonly materials: Uint8Array;
  readonly widthCells: number;
  readonly heightCells: number;
  readonly cellNm: number;
}

/** How fast SiO₂ is etched, and how much slower the other materials are, for one recipe. */
export interface EtchRates {
  /** Rate straight down into SiO₂, nm/min. */
  verticalNmPerMin: number;
  /** Rate sideways (and upwards) into SiO₂, nm/min. */
  lateralNmPerMin: number;
  /** 1 − lateral/vertical: 0 = isotropic, →1 = perfectly vertical. */
  anisotropy: number;
  /** SiO₂ rate ÷ resist rate. Infinity: the resist is not attacked. */
  resistSelectivity: number;
  /** SiO₂ rate ÷ silicon rate. Infinity: the silicon is not attacked. */
  siSelectivity: number;
}

function assertPositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number, got ${value}`);
  }
}

/** Wet SiO₂ etch: chemistry only, so every direction is equally fast and Si and resist are safe. */
export function wetEtchRates(etchant: WetEtchantId): EtchRates {
  const W = constants.etch.wet;
  const rate = W.etchants[etchant].rateNmPerMin.value;
  return {
    verticalNmPerMin: rate,
    lateralNmPerMin: rate,
    anisotropy: 0,
    resistSelectivity: W.resistSelectivity.value,
    siSelectivity: W.siSelectivity.value,
  };
}

export interface RieInput {
  powerW: number;
  pressureMTorr: number;
}

/**
 * RIE of SiO₂ in a fluorocarbon plasma. Higher power: faster, straighter, less selective to
 * resist and Si. Higher pressure: ions collide more, lose direction, etch more sideways.
 */
export function rieRates({ powerW, pressureMTorr }: RieInput): EtchRates {
  assertPositive('powerW', powerW);
  assertPositive('pressureMTorr', pressureMTorr);
  const R = constants.etch.rie;
  const verticalNmPerMin = R.baseRateNmPerMin.value + R.rateNmPerMinPerW.value * powerW;
  const anisotropy = Math.min(
    R.anisotropyMax.value,
    Math.max(
      R.anisotropyMin.value,
      R.anisotropyBase.value -
        pressureMTorr / R.anisotropyPressureScaleMTorr.value -
        (R.anisotropyPowerRefW.value - powerW) / R.anisotropyPowerScaleW.value,
    ),
  );
  return {
    verticalNmPerMin,
    lateralNmPerMin: verticalNmPerMin * (1 - anisotropy),
    anisotropy,
    resistSelectivity: Math.max(
      R.resistSelectivityMin.value,
      R.resistSelectivityBase.value - powerW / R.resistSelectivityPowerScaleW.value,
    ),
    siSelectivity: Math.max(
      R.siSelectivityMin.value,
      R.siSelectivityBase.value - powerW / R.siSelectivityPowerScaleW.value,
    ),
  };
}

/**
 * The 16 steps the front may take: the 8 neighbours plus the 8 knight moves. Fewer directions
 * would make the front diamond- or square-shaped; with 16 it is round to within a few percent.
 */
const STENCIL: readonly (readonly [dx: number, dy: number])[] = (() => {
  const steps: [number, number][] = [];
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const a = Math.abs(dx);
      const b = Math.abs(dy);
      if (a === 0 && b === 0) continue;
      if (a === 2 && b === 2) continue; // would be a repeat of the diagonal
      if ((a === 2 && b === 0) || (a === 0 && b === 2)) continue; // repeat of the axis step
      steps.push([dx, dy]);
    }
  }
  return steps;
})();

/**
 * Time, in minutes, at which the etch front reaches each cell (row-major, same layout as the
 * grid). 0 in air; Infinity where it never arrives (a material that is not attacked, or a cell
 * that cannot be reached because the lateral rate is 0). A cell is etched after time T when its
 * arrival time is ≤ T, so one result serves every etch time.
 *
 * Step (dx, dy) into a cell of material m costs
 *   cell · √((dx/lateral_m)² + (dy/vertical_m)²)
 * where rate_m = rate / selectivity_m, and `vertical_m` is the lateral rate for upward steps.
 */
export function arrivalTime(grid: MaterialGrid, rates: EtchRates): Float64Array {
  const { materials, widthCells: w, heightCells: h, cellNm } = grid;
  assertPositive('cellNm', cellNm);
  if (
    !Number.isInteger(w) ||
    !Number.isInteger(h) ||
    w <= 0 ||
    h <= 0 ||
    materials.length !== w * h
  ) {
    throw new RangeError(`materials has ${materials.length} cells, expected ${w} × ${h}`);
  }
  const n = w * h;

  const arrival = new Float64Array(n).fill(Infinity);
  const selectivity: number[] = [];
  selectivity[AIR] = Infinity;
  selectivity[SI] = rates.siSelectivity;
  selectivity[OX] = 1;
  selectivity[PR] = rates.resistSelectivity;

  // Binary min-heap with lazy deletion (a cell may be pushed several times; stale entries are
  // skipped when popped). Each relaxation pushes at most once, so 24 slots per cell are plenty.
  const heapCell = new Int32Array(n * 24);
  const heapTime = new Float64Array(n * 24);
  let heapSize = 0;
  let topCell = 0;
  let topTime = 0;

  const push = (cell: number, time: number): void => {
    let k = heapSize++;
    while (k > 0) {
      const parent = (k - 1) >> 1;
      if (heapTime[parent]! <= time) break;
      heapCell[k] = heapCell[parent]!;
      heapTime[k] = heapTime[parent]!;
      k = parent;
    }
    heapCell[k] = cell;
    heapTime[k] = time;
  };

  /** Removes the smallest entry and leaves it in topCell / topTime. */
  const pop = (): void => {
    topCell = heapCell[0]!;
    topTime = heapTime[0]!;
    heapSize--;
    const cell = heapCell[heapSize]!;
    const time = heapTime[heapSize]!;
    let k = 0;
    for (;;) {
      const left = 2 * k + 1;
      if (left >= heapSize) break;
      const right = left + 1;
      const child = right < heapSize && heapTime[right]! < heapTime[left]! ? right : left;
      if (heapTime[child]! >= time) break;
      heapCell[k] = heapCell[child]!;
      heapTime[k] = heapTime[child]!;
      k = child;
    }
    heapCell[k] = cell;
    heapTime[k] = time;
  };

  for (let i = 0; i < n; i++) {
    if (materials[i] === AIR) {
      arrival[i] = 0;
      push(i, 0);
    }
  }

  while (heapSize > 0) {
    pop();
    const cell = topCell;
    const time = topTime;
    if (time > arrival[cell]!) continue; // stale entry
    const x = cell % w;
    const y = (cell / w) | 0;
    for (const [dx, dy] of STENCIL) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const next = ny * w + nx;
      const material = materials[next]!;
      if (material === AIR) continue;
      const s = selectivity[material]!;
      if (s === Infinity) continue;
      const vertical = (dy > 0 ? rates.verticalNmPerMin : rates.lateralNmPerMin) / s;
      const lateral = rates.lateralNmPerMin / s;
      if ((dy !== 0 && vertical <= 0) || (dx !== 0 && lateral <= 0)) continue;
      const cost =
        cellNm *
        Math.sqrt((dx !== 0 ? (dx / lateral) ** 2 : 0) + (dy !== 0 ? (dy / vertical) ** 2 : 0));
      const arrives = time + cost;
      if (arrives < arrival[next]!) {
        arrival[next] = arrives;
        push(next, arrives);
      }
    }
  }
  return arrival;
}
