/**
 * FROZEN COPY of `arrivalTime` as it was at commit 4bb8fa2 (src/physics/etch.ts lines 44-48, 101-125,
 * 152-170 and 172-323). It is the reference of tests/physics/arrivalTime.parity.test.ts: the
 * optimised `arrivalTime` must return the same field, bit for bit where the search is unchanged.
 * Do not edit it, tidy it or speed it up; only the name (`arrivalTimeV1`), these imports and the
 * `Material` import path (it moved to physics/materials.ts) differ from the original.
 * Test-only: src/ must never import from here.
 */
import type {
  ArrivalField,
  ArrivalOptions,
  EtchRates,
  MaterialGrid,
} from '../../../src/physics/etch';
import { Material } from '../../../src/physics/materials';

const { AIR, SI, OX, PR } = Material;

function assertPositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number, got ${value}`);
  }
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

// The same steps as two Int8Arrays, read by index in the search loop. Looping over the tuples with
// `for (const [dx, dy] of STENCIL)` allocates an iterator and result objects on every pass while
// the code is not fully optimized, which fills the young generation and makes the occasional run
// several times slower than the rest (measured in docs/PROGRESS.md, "Worker, làm ấm và GC").
const STENCIL_DX = Int8Array.from(STENCIL, ([dx]) => dx);
const STENCIL_DY = Int8Array.from(STENCIL, ([, dy]) => dy);

/** Rates must be usable as divisors and step costs; a selectivity of Infinity means "not attacked". */
function assertRates(rates: EtchRates): void {
  const {
    verticalNmPerMin: v,
    lateralNmPerMin: l,
    resistSelectivity: sr,
    siSelectivity: ss,
  } = rates;
  if (!(Number.isFinite(v) && v > 0)) {
    throw new RangeError(`verticalNmPerMin must be a finite number > 0, got ${v}`);
  }
  if (!(Number.isFinite(l) && l >= 0)) {
    throw new RangeError(`lateralNmPerMin must be a finite number ≥ 0, got ${l}`);
  }
  // `!(x > 0)` also rejects NaN; Infinity is allowed.
  if (!(sr > 0))
    throw new RangeError(`resistSelectivity must be > 0 (Infinity allowed), got ${sr}`);
  if (!(ss > 0)) throw new RangeError(`siSelectivity must be > 0 (Infinity allowed), got ${ss}`);
}

/**
 * Time at which the etch front reaches each cell. A cell is etched after time T when its arrival
 * time is ≤ T, so one result serves every etch time up to `maxTimeMin`; `measureEtch` throws if
 * asked for a later T, because the cells that arrive after the limit are stored as Infinity and
 * would wrongly read as untouched.
 *
 * Step (dx, dy) into a cell of material m costs
 *   cell · √((dx/lateral_m)² + (dy/vertical_m)²)
 * where rate_m = rate / selectivity_m, and `vertical_m` is the lateral rate for upward steps.
 *
 * Throws RangeError for unusable rates (see `assertRates`), a material code the selectivity table
 * does not know, or a grid whose array does not match its dimensions.
 */
export function arrivalTimeV1(
  grid: MaterialGrid,
  rates: EtchRates,
  options: ArrivalOptions = {},
): ArrivalField {
  const { materials, widthCells: w, heightCells: h, cellNm } = grid;
  assertPositive('cellNm', cellNm);
  assertRates(rates);
  if (
    !Number.isInteger(w) ||
    !Number.isInteger(h) ||
    w <= 0 ||
    h <= 0 ||
    materials.length !== w * h
  ) {
    throw new RangeError(`materials has ${materials.length} cells, expected ${w} × ${h}`);
  }
  const limit = options.maxTimeMin ?? Infinity;
  if (Number.isNaN(limit) || limit < 0) {
    throw new RangeError(`maxTimeMin must be a number ≥ 0, got ${limit}`);
  }
  const n = w * h;

  const arrival = new Float64Array(n).fill(Infinity);
  const selectivity: number[] = [];
  selectivity[AIR] = Infinity;
  selectivity[SI] = rates.siSelectivity;
  selectivity[OX] = 1;
  selectivity[PR] = rates.resistSelectivity;

  // Binary min-heap of solid cells with lazy deletion (a cell may be pushed several times; stale
  // entries are skipped when popped). A cell is pushed only when its time strictly improves, once
  // per neighbour that can reach it, so 16 slots per solid cell is a hard upper bound.
  let solidCells = 0;
  for (let i = 0; i < n; i++) {
    const code = materials[i]!;
    if (code === AIR) continue;
    // A code outside the table would make a step cost NaN and silently corrupt the field.
    if (selectivity[code] === undefined) {
      throw new RangeError(`unknown material code ${code} at cell ${i}`);
    }
    solidCells++;
  }
  const capacity = Math.max(1, solidCells * STENCIL.length);
  const heapCell = new Int32Array(capacity);
  const heapTime = new Float64Array(capacity);
  let heapSize = 0;
  let topCell = 0;
  let topTime = 0;

  const push = (cell: number, time: number): void => {
    // Never true if the bound above holds; writing past a typed array would silently drop entries.
    if (heapSize >= capacity)
      throw new Error('arrivalTime: heap capacity exceeded (internal error)');
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

  // One search loop. Its sources are first every air cell (reached at time 0, taken straight from
  // the grid instead of through the heap: popping thousands of air cells one by one was most of the
  // work) and then the heap. The relaxation is written inline: as a closure its captured variables
  // live in a context object and the loop measurably slows down.
  let airScan = 0;
  for (;;) {
    let cell: number;
    let time: number;
    while (airScan < n && materials[airScan] !== AIR) airScan++;
    if (airScan < n) {
      cell = airScan++;
      time = 0;
      arrival[cell] = 0;
    } else if (heapSize > 0) {
      pop();
      if (topTime > arrival[topCell]!) continue; // stale entry
      cell = topCell;
      time = topTime;
    } else {
      break;
    }

    const x = cell % w;
    const y = (cell / w) | 0;
    for (let step = 0; step < STENCIL_DX.length; step++) {
      const dx = STENCIL_DX[step]!;
      const dy = STENCIL_DY[step]!;
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
      if (arrives > limit) continue;
      if (arrives < arrival[next]!) {
        arrival[next] = arrives;
        push(next, arrives);
      }
    }
  }
  return { arrival, maxTimeMin: limit };
}
