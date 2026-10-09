/**
 * The table of what it costs the etch front to step into a cell, per material and per step of the
 * stencil (src/physics/etch.ts). The search loop only looks it up, so every blocking rule of the
 * old per-step arithmetic has to live here, exactly: a material that is not attacked, and a
 * direction whose rate is 0. A lateral rate of 0 must still let the straight-down steps run.
 */
import { describe, expect, it } from 'vitest';
import {
  rieRates,
  stepCostTable,
  STENCIL,
  wetEtchRates,
  type EtchRates,
} from '../../src/physics/etch';
import { Material, MATERIAL_COUNT } from '../../src/physics/materials';

const rates = (over: Partial<EtchRates> = {}): EtchRates => ({
  verticalNmPerMin: 100,
  lateralNmPerMin: 20,
  anisotropy: 0.8,
  resistSelectivity: 4,
  siSelectivity: 10,
  ...over,
});

const stepIndex = (dx: number, dy: number) => STENCIL.findIndex(([x, y]) => x === dx && y === dy);
const at = (table: Float64Array, material: number, dx: number, dy: number) =>
  table[material * STENCIL.length + stepIndex(dx, dy)]!;

/** The cost written the way the search loop used to compute it on every step, as the reference. */
function directCost(r: EtchRates, cellNm: number, material: number, dx: number, dy: number) {
  const s = [Infinity, r.siSelectivity, 1, r.resistSelectivity][material]!;
  if (s === Infinity) return Infinity;
  const vertical = (dy > 0 ? r.verticalNmPerMin : r.lateralNmPerMin) / s;
  const lateral = r.lateralNmPerMin / s;
  if ((dy !== 0 && vertical <= 0) || (dx !== 0 && lateral <= 0)) return Infinity;
  return (
    cellNm * Math.sqrt((dx !== 0 ? (dx / lateral) ** 2 : 0) + (dy !== 0 ? (dy / vertical) ** 2 : 0))
  );
}

const RATE_SETS: EtchRates[] = [
  rates(),
  rates({ lateralNmPerMin: 100, resistSelectivity: 1, siSelectivity: 1 }),
  rates({ lateralNmPerMin: 0.5, resistSelectivity: 1.4, siSelectivity: 5 }),
  rates({ resistSelectivity: Infinity }),
  rates({ resistSelectivity: Infinity, siSelectivity: Infinity }),
  rates({ lateralNmPerMin: 0 }),
  rates({ lateralNmPerMin: 0, resistSelectivity: Infinity }),
  wetEtchRates('boe6'),
  rieRates({ powerW: 200, pressureMTorr: 30 }),
  rieRates({ powerW: 80, pressureMTorr: 180 }),
];

describe('stepCostTable layout', () => {
  it('has one row per material and one column per step, row-major', () => {
    expect(STENCIL).toHaveLength(16);
    expect(MATERIAL_COUNT).toBe(4);
    expect(stepCostTable(rates(), 10)).toHaveLength(MATERIAL_COUNT * STENCIL.length);
  });

  it.each(RATE_SETS.map((r, i) => [i, r] as const))(
    'rate set %i: every entry is the cost the search used to compute per step, to the bit',
    (_i, r) => {
      const table = stepCostTable(r, 10);
      for (let material = 0; material < MATERIAL_COUNT; material++) {
        STENCIL.forEach(([dx, dy], step) => {
          const expected = directCost(r, 10, material, dx, dy);
          expect(table[material * STENCIL.length + step], `m${material} (${dx},${dy})`).toBe(
            expected,
          );
        });
      }
    },
  );
});

describe('stepCostTable blocking', () => {
  it('never steps into air: the front is already there', () => {
    for (const r of RATE_SETS) {
      STENCIL.forEach(([dx, dy]) =>
        expect(at(stepCostTable(r, 10), Material.AIR, dx, dy)).toBe(Infinity),
      );
    }
  });

  it('never steps into a material that is not attacked (selectivity Infinity)', () => {
    const table = stepCostTable(
      rates({ resistSelectivity: Infinity, siSelectivity: Infinity }),
      10,
    );
    STENCIL.forEach(([dx, dy]) => {
      expect(at(table, Material.PR, dx, dy)).toBe(Infinity);
      expect(at(table, Material.SI, dx, dy)).toBe(Infinity);
      expect(at(table, Material.OX, dx, dy)).toBeLessThan(Infinity); // oxide is always attacked
    });
  });

  describe('with a lateral rate of 0', () => {
    const table = stepCostTable(rates({ lateralNmPerMin: 0 }), 10);

    it('still lets the straight-down step run, at the vertical rate', () => {
      expect(at(table, Material.OX, 0, 1)).toBeCloseTo(10 / 100, 12);
      expect(at(table, Material.PR, 0, 1)).toBeCloseTo(10 / (100 / 4), 12);
      expect(at(table, Material.SI, 0, 1)).toBeCloseTo(10 / (100 / 10), 12);
    });

    it('blocks the straight-up step: going up uses the lateral rate', () => {
      for (const m of [Material.OX, Material.PR, Material.SI])
        expect(at(table, m, 0, -1)).toBe(Infinity);
    });

    it('blocks every step with a sideways part, up, level or down', () => {
      for (const m of [Material.OX, Material.PR, Material.SI]) {
        STENCIL.forEach(([dx, dy]) => {
          if (dx !== 0) expect(at(table, m, dx, dy), `m${m} (${dx},${dy})`).toBe(Infinity);
        });
      }
    });

    it('is not "rate 0 means no steps at all": exactly one step per attacked material is open', () => {
      for (const m of [Material.OX, Material.PR, Material.SI]) {
        const open = STENCIL.filter(([dx, dy]) => at(table, m, dx, dy) < Infinity);
        expect(open).toEqual([[0, 1]]);
      }
    });
  });

  it('with a vertical rate of 0 blocks the downward steps only, since up and level use the lateral rate', () => {
    // assertRates rejects a vertical rate of 0, so this is the table's own rule, tested directly
    const table = stepCostTable(rates({ verticalNmPerMin: 0 }), 10);
    STENCIL.forEach(([dx, dy]) => {
      const blocked = at(table, Material.OX, dx, dy) === Infinity;
      expect(blocked, `(${dx},${dy})`).toBe(dy > 0);
    });
  });
});

describe('stepCostTable laws', () => {
  it('a step costs the same mirrored left-right (this is what lets a mirror-symmetric grid be halved)', () => {
    for (const r of RATE_SETS) {
      const table = stepCostTable(r, 10);
      for (let m = 0; m < MATERIAL_COUNT; m++) {
        STENCIL.forEach(([dx, dy]) => expect(at(table, m, -dx, dy)).toBe(at(table, m, dx, dy)));
      }
    }
  });

  it('goes up at the lateral rate and down at the vertical rate', () => {
    const table = stepCostTable(rates({ verticalNmPerMin: 100, lateralNmPerMin: 25 }), 10);
    expect(at(table, Material.OX, 0, 1)).toBeCloseTo(10 / 100, 12);
    expect(at(table, Material.OX, 0, -1)).toBeCloseTo(10 / 25, 12);
    expect(at(table, Material.OX, 1, 0)).toBeCloseTo(10 / 25, 12);
  });

  it('scales with the cell size and inversely with the rates', () => {
    const base = stepCostTable(rates(), 10);
    const bigger = stepCostTable(rates(), 20);
    const faster = stepCostTable(rates({ verticalNmPerMin: 200, lateralNmPerMin: 40 }), 10);
    base.forEach((c, i) => {
      if (c === Infinity) return;
      expect(bigger[i]!).toBeCloseTo(2 * c, 12);
      expect(faster[i]!).toBeCloseTo(c / 2, 12);
    });
  });

  it('is slower in a material with a higher selectivity, by exactly that factor', () => {
    const table = stepCostTable(rates({ resistSelectivity: 4 }), 10);
    STENCIL.forEach(([dx, dy]) => {
      expect(at(table, Material.PR, dx, dy)).toBeCloseTo(4 * at(table, Material.OX, dx, dy), 12);
    });
  });
});

describe('stepCostTable has no NaN', () => {
  it('for every rate the app can produce: wet etchants, and RIE over the whole control range', () => {
    const sets: EtchRates[] = [wetEtchRates('boe10'), wetEtchRates('boe6'), wetEtchRates('hf49')];
    for (let powerW = 50; powerW <= 300; powerW += 25) {
      for (let pressureMTorr = 10; pressureMTorr <= 200; pressureMTorr += 10) {
        sets.push(rieRates({ powerW, pressureMTorr }));
      }
    }
    for (const r of sets) {
      expect([...stepCostTable(r, 10)].some(Number.isNaN)).toBe(false);
    }
  });

  it.each([
    ['vertical rate', { verticalNmPerMin: Number.NaN }],
    ['lateral rate', { lateralNmPerMin: Number.NaN }],
    ['resist selectivity', { resistSelectivity: Number.NaN }],
    ['silicon selectivity', { siSelectivity: Number.NaN }],
  ])('refuses to build a table from a NaN %s', (_name, bad) => {
    expect(() => stepCostTable(rates(bad), 10)).toThrow(RangeError);
  });

  it('refuses to build a table from a NaN cell size', () => {
    expect(() => stepCostTable(rates(), Number.NaN)).toThrow(RangeError);
  });
});
