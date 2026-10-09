/**
 * `arrivalTime` against the frozen copy of it from commit 4bb8fa2 (legacy/arrivalTimeV1.ts): the
 * speed-ups (a precomputed cost table, later a half-grid search for mirror-symmetric grids) must not
 * change the field. Compared as bits (`Object.is` per cell), not with a tolerance: the search
 * visits the same cells in the same order with the same costs, so the answer is the same number.
 *
 * Inputs: the three regression cases of docs/modules/m04-etch.md on the real 260 × 150 grid, and
 * seeded random grids — mirror-symmetric ones, ones that differ from symmetric in exactly one
 * cell, and unrelated ones — with the rate sets that exercise every blocking rule: a material that
 * is not attacked, a lateral rate of 0, tiny and large lateral rates.
 */
import { describe, expect, it } from 'vitest';
import { arrivalTime, type EtchRates, type MaterialGrid } from '../../src/physics/etch';
import { Material } from '../../src/physics/materials';
import { M04_CASES } from '../../src/sim/cases';
import { etchTimeMaxMin, runRecipe } from '../../src/sim/recipe';
import { arrivalTimeV1 } from './legacy/arrivalTimeV1';

/** Deterministic PRNG (mulberry32) so a failure is reproducible. */
function prng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CODES = [Material.AIR, Material.SI, Material.OX, Material.PR];
const randomCode = (rand: () => number) => {
  const v = rand();
  return v < 0.3 ? Material.AIR : v < 0.5 ? Material.PR : v < 0.8 ? Material.OX : Material.SI;
};

function grid(materials: Uint8Array, widthCells: number, heightCells: number): MaterialGrid {
  return { materials, widthCells, heightCells, cellNm: 10 };
}

function randomGrid(rand: () => number, w: number, h: number): MaterialGrid {
  const materials = new Uint8Array(w * h);
  for (let i = 0; i < materials.length; i++) materials[i] = randomCode(rand);
  return grid(materials, w, h);
}

/** x ↔ w − 1 − x in every row; an odd width leaves the middle column free. */
function symmetricGrid(rand: () => number, w: number, h: number): MaterialGrid {
  const materials = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < Math.ceil(w / 2); x++) {
      materials[y * w + x] = materials[y * w + (w - 1 - x)] = randomCode(rand);
    }
  }
  return grid(materials, w, h);
}

/** Symmetric except for one cell left of the axis, which gets another material. */
function oneCellOffGrid(rand: () => number, w: number, h: number): MaterialGrid {
  const g = symmetricGrid(rand, w, h);
  const x = Math.floor(rand() * Math.floor(w / 2)); // strictly left of the axis, so it has a mirror
  const y = Math.floor(rand() * h);
  const i = y * w + x;
  const others = CODES.filter((c) => c !== g.materials[i]);
  g.materials[i] = others[Math.floor(rand() * others.length)]!;
  return g;
}

const rates = (over: Partial<EtchRates> = {}): EtchRates => ({
  verticalNmPerMin: 100,
  lateralNmPerMin: 100,
  anisotropy: 0,
  resistSelectivity: Infinity,
  siSelectivity: Infinity,
  ...over,
});

const RATE_SETS: [string, EtchRates][] = [
  ['isotropic, everything attacked', rates({ resistSelectivity: 1, siSelectivity: 1 })],
  [
    'anisotropic, resist and silicon slow',
    rates({ lateralNmPerMin: 10, resistSelectivity: 3, siSelectivity: 12 }),
  ],
  ['tiny lateral rate', rates({ lateralNmPerMin: 0.5, resistSelectivity: 1.4, siSelectivity: 5 })],
  ['resist not attacked', rates({ lateralNmPerMin: 40, siSelectivity: 7 })],
  ['lateral rate 0', rates({ lateralNmPerMin: 0, resistSelectivity: 2, siSelectivity: 2 })],
  ['lateral rate 0, resist not attacked', rates({ lateralNmPerMin: 0, siSelectivity: 3 })],
  ['nothing but oxide attacked', rates({ lateralNmPerMin: 25 })],
];

/** Same length, and every value the same bits (Infinity included). Names the first cell that differs. */
function expectSameField(actual: Float64Array, expected: Float64Array, tag: string) {
  expect(actual.length, tag).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    if (!Object.is(actual[i], expected[i])) {
      expect.fail(`${tag}: cell ${i} is ${actual[i]}, the 4bb8fa2 code gives ${expected[i]}`);
    }
  }
}

function expectParity(g: MaterialGrid, r: EtchRates, maxTimeMin: number | undefined, tag: string) {
  const options = maxTimeMin === undefined ? {} : { maxTimeMin };
  const now = arrivalTime(g, r, options);
  const before = arrivalTimeV1(g, r, options);
  expect(now.maxTimeMin, `${tag} maxTimeMin`).toBe(before.maxTimeMin);
  expectSameField(now.arrival, before.arrival, tag);
}

describe('arrivalTime keeps the answer of 4bb8fa2 on the regression cases A, B, C', () => {
  for (const { id, recipe } of M04_CASES) {
    const { section, rates: r } = runRecipe(recipe);

    it(`case ${id} on the 260 × 150 grid, searched as the app does (up to the largest etch time)`, () => {
      expectParity(section, r, etchTimeMaxMin(recipe.etch), `case ${id} limited`);
    });

    it(`case ${id} with no limit at all`, () => {
      expectParity(section, r, undefined, `case ${id} unlimited`);
    });

    it(`case ${id} stopped at the time the learner picked`, () => {
      expectParity(section, r, recipe.etch.timeMin, `case ${id} at timeMin`);
    });
  }
});

const SIZES: [number, number][] = [
  [1, 1],
  [1, 7],
  [2, 2],
  [2, 9],
  [3, 3],
  [4, 4],
  [5, 4],
  [17, 12],
  [18, 15],
  [41, 20],
  [60, 40],
];

describe.each([
  ['symmetric', symmetricGrid],
  ['symmetric but for one cell', oneCellOffGrid],
  ['unrelated to symmetry', randomGrid],
] as const)(
  'arrivalTime keeps the answer of 4bb8fa2 on random grids that are %s',
  (_name, make) => {
    describe.each(SIZES)('%i × %i cells (even and odd widths)', (w, h) => {
      it.each(RATE_SETS)('%s', (label, r) => {
        // one seed per grid and rate set, so a failure names a case that can be rebuilt
        const seed = 7919 * w + 104729 * h + label.length;
        const g = make(prng(seed), w, h);
        expectParity(g, r, undefined, `${w}×${h} seed ${seed}`);
      });

      it('with a limit in the middle of the field, with 0 and with a limit no cell reaches', () => {
        const seed = 31 * w + 17 * h;
        const g = make(prng(seed), w, h);
        const r = rates({ lateralNmPerMin: 20, resistSelectivity: 3, siSelectivity: 8 });
        const full = arrivalTimeV1(g, r).arrival;
        const finite = [...full].filter((t) => Number.isFinite(t) && t > 0).sort((a, b) => a - b);
        const middle = finite.length ? finite[Math.floor(finite.length / 2)]! : 1;
        for (const limit of [middle, 0, 1e-9]) {
          expectParity(g, r, limit, `${w}×${h} seed ${seed} limit ${limit}`);
        }
      });
    });
  },
);

describe('the parity check itself', () => {
  it('sees a one-bit difference', () => {
    const a = new Float64Array([1, 2, 3]);
    const b = a.slice();
    b[1] = 2 + Number.EPSILON * 2; // the next double above 2: one bit
    expect(() => expectSameField(a, b, 'x')).toThrow(/cell 1/);
  });

  it('treats Infinity as equal to Infinity', () => {
    const a = new Float64Array([Infinity, 0]);
    expect(() => expectSameField(a, a.slice(), 'x')).not.toThrow();
  });
});
