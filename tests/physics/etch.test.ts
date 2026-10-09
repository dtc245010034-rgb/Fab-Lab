import { describe, expect, it } from 'vitest';
import { constants } from '../../src/physics/constants';
import {
  arrivalTime,
  rieRates,
  wetEtchRates,
  type EtchRates,
  type MaterialGrid,
} from '../../src/physics/etch';
import { Material } from '../../src/physics/materials';

const range = (from: number, to: number, step: number) => {
  const out: number[] = [];
  for (let v = from; v <= to + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
};

/** ASCII fixture: '.' air, 'S' silicon, 'O' oxide, 'P' resist. One string per row, top first. */
function gridOf(rows: string[], cellNm = 10): MaterialGrid {
  const code: Record<string, number> = {
    '.': Material.AIR,
    S: Material.SI,
    O: Material.OX,
    P: Material.PR,
  };
  const widthCells = rows[0]!.length;
  const materials = new Uint8Array(widthCells * rows.length);
  rows.forEach((row, y) => {
    expect(row.length).toBe(widthCells);
    [...row].forEach((ch, x) => {
      materials[y * widthCells + x] = code[ch]!;
    });
  });
  return { materials, widthCells, heightCells: rows.length, cellNm };
}

/** The arrival-time array only; the field object is checked in its own tests. */
const arrive = (...args: Parameters<typeof arrivalTime>) => arrivalTime(...args).arrival;

const rates = (over: Partial<EtchRates> = {}): EtchRates => ({
  verticalNmPerMin: 100,
  lateralNmPerMin: 100,
  anisotropy: 0,
  resistSelectivity: Infinity,
  siSelectivity: Infinity,
  ...over,
});

describe('wetEtchRates', () => {
  it.each(['boe10', 'boe6', 'hf49'] as const)('%s etches the same in every direction', (id) => {
    const r = wetEtchRates(id);
    expect(r.verticalNmPerMin).toBe(constants.etch.wet.etchants[id].rateNmPerMin.value);
    expect(r.lateralNmPerMin).toBe(r.verticalNmPerMin);
    expect(r.anisotropy).toBe(0);
  });

  it('does not attack resist or silicon', () => {
    const r = wetEtchRates('boe6');
    expect(r.resistSelectivity).toBe(Infinity);
    expect(r.siSelectivity).toBe(Infinity);
  });

  it('is faster the stronger the etchant', () => {
    expect(wetEtchRates('boe10').verticalNmPerMin).toBeLessThan(
      wetEtchRates('boe6').verticalNmPerMin,
    );
    expect(wetEtchRates('boe6').verticalNmPerMin).toBeLessThan(
      wetEtchRates('hf49').verticalNmPerMin,
    );
  });
});

describe('rieRates', () => {
  // Output of the prototype's etchRates() (reference/prototype-m04-etch.html); tier C, so this pins
  // the port to the prototype rather than to a textbook.
  it('matches the prototype at 200 W / 30 mTorr', () => {
    const r = rieRates({ powerW: 200, pressureMTorr: 30 });
    expect(r.verticalNmPerMin).toBeCloseTo(70, 12);
    expect(r.anisotropy).toBeCloseTo(0.9433333333333334, 12);
    expect(r.lateralNmPerMin).toBeCloseTo(3.966666666666665, 12);
    expect(r.resistSelectivity).toBeCloseTo(3.5555555555555554, 12);
    expect(r.siSelectivity).toBeCloseTo(10, 12);
  });

  it('matches the prototype at 80 W / 180 mTorr (anisotropy at its lower clamp)', () => {
    const r = rieRates({ powerW: 80, pressureMTorr: 180 });
    expect(r.verticalNmPerMin).toBeCloseTo(40, 12);
    expect(r.anisotropy).toBe(constants.etch.rie.anisotropyMin.value);
    expect(r.lateralNmPerMin).toBeCloseTo(30, 12);
    expect(r.resistSelectivity).toBeCloseTo(6.222222222222222, 12);
    expect(r.siSelectivity).toBeCloseTo(13, 12);
  });

  it('etches faster at higher power', () => {
    const v = range(50, 300, 10).map(
      (powerW) => rieRates({ powerW, pressureMTorr: 30 }).verticalNmPerMin,
    );
    for (let i = 1; i < v.length; i++) expect(v[i]!).toBeGreaterThan(v[i - 1]!);
  });

  it('is less anisotropic at higher pressure, so more of the etch goes sideways', () => {
    for (const powerW of [50, 150, 300]) {
      const r = range(10, 200, 5).map((pressureMTorr) => rieRates({ powerW, pressureMTorr }));
      for (let i = 1; i < r.length; i++) {
        expect(r[i]!.anisotropy, `${powerW} W`).toBeLessThanOrEqual(r[i - 1]!.anisotropy);
        expect(r[i]!.lateralNmPerMin, `${powerW} W`).toBeGreaterThanOrEqual(
          r[i - 1]!.lateralNmPerMin,
        );
      }
    }
  });

  it('is more anisotropic at higher power', () => {
    const a = range(50, 300, 10).map(
      (powerW) => rieRates({ powerW, pressureMTorr: 100 }).anisotropy,
    );
    for (let i = 1; i < a.length; i++) expect(a[i]!).toBeGreaterThanOrEqual(a[i - 1]!);
  });

  it('is less selective against resist and silicon at higher power, never below the floor', () => {
    const r = range(50, 300, 10).map((powerW) => rieRates({ powerW, pressureMTorr: 30 }));
    for (let i = 1; i < r.length; i++) {
      expect(r[i]!.resistSelectivity).toBeLessThanOrEqual(r[i - 1]!.resistSelectivity);
      expect(r[i]!.siSelectivity).toBeLessThanOrEqual(r[i - 1]!.siSelectivity);
    }
    for (const x of r) {
      expect(x.resistSelectivity).toBeGreaterThanOrEqual(
        constants.etch.rie.resistSelectivityMin.value,
      );
      expect(x.siSelectivity).toBeGreaterThanOrEqual(constants.etch.rie.siSelectivityMin.value);
    }
  });

  it('keeps anisotropy inside its clamps and lateral rate positive and consistent with it', () => {
    for (const powerW of range(50, 300, 25)) {
      for (const pressureMTorr of range(10, 200, 10)) {
        const r = rieRates({ powerW, pressureMTorr });
        const tag = `${powerW} W / ${pressureMTorr} mTorr`;
        expect(r.anisotropy, tag).toBeGreaterThanOrEqual(constants.etch.rie.anisotropyMin.value);
        expect(r.anisotropy, tag).toBeLessThanOrEqual(constants.etch.rie.anisotropyMax.value);
        expect(r.lateralNmPerMin, tag).toBeGreaterThan(0);
        expect(r.lateralNmPerMin, tag).toBeCloseTo(r.verticalNmPerMin * (1 - r.anisotropy), 9);
      }
    }
  });

  it.each([
    { powerW: 0, pressureMTorr: 30 },
    { powerW: -10, pressureMTorr: 30 },
    { powerW: 200, pressureMTorr: 0 },
    { powerW: Number.NaN, pressureMTorr: 30 },
    { powerW: 200, pressureMTorr: Number.POSITIVE_INFINITY },
  ])('rejects invalid input %o', (input) => {
    expect(() => rieRates(input)).toThrow(RangeError);
  });
});

describe('arrivalTime (shortest-path etch front)', () => {
  it('is 0 in air and grows by one cell-time per cell straight down', () => {
    const g = gridOf(['.', 'O', 'O', 'O', 'O']);
    const t = arrive(g, rates({ verticalNmPerMin: 100, lateralNmPerMin: 100 }));
    expect(t.length).toBe(5);
    expect(t[0]).toBe(0);
    for (let k = 1; k <= 4; k++) expect(t[k]!).toBeCloseTo((k * 10) / 100, 12);
  });

  it('goes up at the lateral rate, not the vertical rate', () => {
    const g = gridOf(['O', 'O', 'O', '.']);
    const t = arrive(g, rates({ verticalNmPerMin: 100, lateralNmPerMin: 20 }));
    expect(t[2]!).toBeCloseTo(10 / 20, 12);
    expect(t[1]!).toBeCloseTo(20 / 20, 12);
    expect(t[0]!).toBeCloseTo(30 / 20, 12);
  });

  it('goes sideways at the lateral rate: d cells from an air face take d·cell/lateral', () => {
    const g = gridOf(['..OOOOOO', '..OOOOOO', '..OOOOOO']);
    const t = arrive(g, rates({ verticalNmPerMin: 100, lateralNmPerMin: 25 }));
    const midRow = 1 * 8;
    for (let d = 1; d <= 6; d++) expect(t[midRow + 1 + d]!).toBeCloseTo((d * 10) / 25, 12);
  });

  it('scales with the cell size (nm) and inversely with the rate (nm/min)', () => {
    const rows = ['.', 'O', 'O'];
    const a = arrive(gridOf(rows, 10), rates({ verticalNmPerMin: 100 }));
    const b = arrive(gridOf(rows, 20), rates({ verticalNmPerMin: 100 }));
    const c = arrive(gridOf(rows, 10), rates({ verticalNmPerMin: 50 }));
    expect(b[2]!).toBeCloseTo(2 * a[2]!, 12);
    expect(c[2]!).toBeCloseTo(2 * a[2]!, 12);
  });

  it('slows down in a material by its selectivity, and never enters one that is not attacked', () => {
    const rows = ['.', 'P', 'P', 'S', 'S'];
    const slow = arrive(gridOf(rows), rates({ resistSelectivity: 4, siSelectivity: 10 }));
    expect(slow[1]!).toBeCloseTo((10 * 4) / 100, 12);
    expect(slow[2]!).toBeCloseTo((2 * 10 * 4) / 100, 12);
    expect(slow[3]!).toBeCloseTo((2 * 10 * 4) / 100 + (10 * 10) / 100, 12);
    const blocked = arrive(gridOf(rows), rates());
    expect(blocked[1]).toBe(Infinity);
    expect(blocked[3]).toBe(Infinity);
  });

  it('with zero lateral rate only moves straight down, so cells beside a window stay untouched', () => {
    const g = gridOf(['..OO', 'OOOO', 'OOOO']);
    const t = arrive(g, rates({ lateralNmPerMin: 0, anisotropy: 1 }));
    expect(t[1 * 4 + 0]!).toBeCloseTo(10 / 100, 12);
    expect(t[2 * 4 + 1]!).toBeCloseTo(20 / 100, 12);
    expect(t[0 * 4 + 2]).toBe(Infinity);
    expect(t[1 * 4 + 2]).toBe(Infinity);
    expect(t[2 * 4 + 3]).toBe(Infinity);
  });

  it('in an isotropic medium never beats a straight line and stays within a few % of it', () => {
    const size = 41;
    const rows = Array.from({ length: size }, (_, y) =>
      y === 0 ? 'O'.repeat(20) + '.' + 'O'.repeat(20) : 'O'.repeat(size),
    );
    const cell = 10;
    const rate = 100;
    const t = arrive(gridOf(rows, cell), rates({ verticalNmPerMin: rate, lateralNmPerMin: rate }));
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (x === 20 && y === 0) continue;
        const straight = (Math.hypot(x - 20, y) * cell) / rate;
        const tag = `(${x},${y})`;
        expect(t[y * size + x]!, tag).toBeGreaterThanOrEqual(straight - 1e-9);
        expect(t[y * size + x]!, tag).toBeLessThanOrEqual(straight * 1.04 + 1e-9);
      }
    }
  });

  it('is unchanged by mirroring the grid left-right', () => {
    const rows = ['...OO.....', '.OOOOO....', 'PPOOOOSSSS', 'SSSSSSSSSS'];
    const mirrored = rows.map((r) => [...r].reverse().join(''));
    const r = rates({ lateralNmPerMin: 30, resistSelectivity: 3, siSelectivity: 8 });
    const a = arrive(gridOf(rows), r);
    const b = arrive(gridOf(mirrored), r);
    const w = rows[0]!.length;
    for (let y = 0; y < rows.length; y++) {
      for (let x = 0; x < w; x++) expect(a[y * w + x]!).toBeCloseTo(b[y * w + (w - 1 - x)]!, 12);
    }
  });

  it('rejects a grid whose arrays do not match its dimensions or has a non-positive cell size', () => {
    const g = gridOf(['.', 'O']);
    expect(() => arrive({ ...g, widthCells: 3 }, rates())).toThrow(RangeError);
    expect(() => arrive({ ...g, cellNm: 0 }, rates())).toThrow(RangeError);
  });
});

describe('arrivalTime with maxTimeMin (stop the search at the largest time the learner can pick)', () => {
  // Resist with a window, oxide, silicon: every material reachable, so the full field is finite.
  const width = 30;
  const layered = (() => {
    const rows: string[] = [];
    for (let y = 0; y < 22; y++) {
      if (y < 4) rows.push('.'.repeat(width));
      else if (y < 9) rows.push('P'.repeat(12) + '.'.repeat(6) + 'P'.repeat(12));
      else if (y < 15) rows.push('O'.repeat(width));
      else rows.push('S'.repeat(width));
    }
    return gridOf(rows);
  })();
  const r = rates({ lateralNmPerMin: 30, resistSelectivity: 3, siSelectivity: 8 });
  const full = arrive(layered, r);
  const finite = [...full].filter((t) => Number.isFinite(t) && t > 0).sort((a, b) => a - b);
  const median = finite[Math.floor(finite.length / 2)]!;

  it('keeps every arrival time up to the limit and marks the rest unreached', () => {
    const bounded = arrive(layered, r, { maxTimeMin: median });
    let kept = 0;
    full.forEach((t, i) => {
      if (t <= median) {
        expect(bounded[i]!, `cell ${i}`).toBeCloseTo(t, 12);
        kept++;
      } else {
        expect(bounded[i], `cell ${i}`).toBe(Infinity);
      }
    });
    expect(kept).toBeGreaterThan(0);
    expect(kept).toBeLessThan(full.length);
  });

  it('includes a cell that arrives exactly at the limit', () => {
    const i = full.indexOf(finite[Math.floor(finite.length / 3)]!);
    const bounded = arrive(layered, r, { maxTimeMin: full[i]! });
    expect(bounded[i]).toBe(full[i]);
  });

  it('is the same as no limit when the limit is omitted or Infinity', () => {
    expect(arrive(layered, r, {})).toEqual(full);
    expect(arrive(layered, r, { maxTimeMin: Infinity })).toEqual(full);
  });

  it('with limit 0 reaches nothing but air', () => {
    const bounded = arrive(layered, r, { maxTimeMin: 0 });
    bounded.forEach((t, i) => {
      expect(t, `cell ${i}`).toBe(layered.materials[i] === Material.AIR ? 0 : Infinity);
    });
  });

  it.each([-1, Number.NaN])('rejects limit %s', (maxTimeMin) => {
    expect(() => arrive(layered, r, { maxTimeMin })).toThrow(RangeError);
  });
});

describe('arrivalTime against a plain O(n²) Dijkstra (no heap) on random grids', () => {
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
  /** The 16 steps, written out independently of the implementation. */
  const STEPS: [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
    [1, 2],
    [1, -2],
    [-1, 2],
    [-1, -2],
    [2, 1],
    [2, -1],
    [-2, 1],
    [-2, -1],
  ];
  function reference(g: MaterialGrid, r: EtchRates): number[] {
    const { materials, widthCells: w, heightCells: h, cellNm } = g;
    const sel = [Infinity, r.siSelectivity, 1, r.resistSelectivity];
    const t: number[] = Array.from(materials, (m) => (m === Material.AIR ? 0 : Infinity));
    const done = new Array<boolean>(w * h).fill(false);
    for (;;) {
      let best = -1;
      for (let i = 0; i < t.length; i++) {
        if (!done[i] && Number.isFinite(t[i]!) && (best < 0 || t[i]! < t[best]!)) best = i;
      }
      if (best < 0) return t;
      done[best] = true;
      const x = best % w;
      const y = Math.floor(best / w);
      for (const [dx, dy] of STEPS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        const m = materials[j]!;
        if (m === Material.AIR || sel[m] === Infinity) continue;
        const vertical = (dy > 0 ? r.verticalNmPerMin : r.lateralNmPerMin) / sel[m]!;
        const lateral = r.lateralNmPerMin / sel[m]!;
        if ((dy !== 0 && vertical <= 0) || (dx !== 0 && lateral <= 0)) continue;
        const cost = cellNm * Math.hypot(dx !== 0 ? dx / lateral : 0, dy !== 0 ? dy / vertical : 0);
        if (t[best]! + cost < t[j]!) t[j] = t[best]! + cost;
      }
    }
  }

  const rateSets: EtchRates[] = [
    rates({ lateralNmPerMin: 100, resistSelectivity: 1, siSelectivity: 1 }),
    rates({ lateralNmPerMin: 10, resistSelectivity: 3, siSelectivity: 12 }),
    rates({ lateralNmPerMin: 0.5, resistSelectivity: 1.4, siSelectivity: 5 }),
    rates({ lateralNmPerMin: 40, resistSelectivity: Infinity, siSelectivity: 7 }),
    rates({ lateralNmPerMin: 0, resistSelectivity: 2, siSelectivity: 2 }),
  ];

  it.each(rateSets.map((r, i) => [i, r] as const))('rate set %i', (i, r) => {
    const rand = prng(1000 + i);
    const width = 18;
    const height = 15;
    const materials = new Uint8Array(width * height);
    for (let k = 0; k < materials.length; k++) {
      const v = rand();
      materials[k] =
        v < 0.3 ? Material.AIR : v < 0.5 ? Material.PR : v < 0.8 ? Material.OX : Material.SI;
    }
    const grid: MaterialGrid = { materials, widthCells: width, heightCells: height, cellNm: 10 };
    const expected = reference(grid, r);
    const actual = arrive(grid, r);
    expected.forEach((t, k) => {
      if (Number.isFinite(t)) expect(actual[k]!, `cell ${k}`).toBeCloseTo(t, 9);
      else expect(actual[k], `cell ${k}`).toBe(Infinity);
    });
  });
});

describe('arrivalTime result', () => {
  const g = gridOf(['.', 'O', 'O']);

  it('returns the arrival times together with the limit they are valid up to', () => {
    const field = arrivalTime(g, rates(), { maxTimeMin: 5 });
    expect(field.maxTimeMin).toBe(5);
    expect(field.arrival).toBeInstanceOf(Float64Array);
    expect(field.arrival.length).toBe(3);
  });

  it('says the limit is Infinity when none was given', () => {
    expect(arrivalTime(g, rates()).maxTimeMin).toBe(Infinity);
    expect(arrivalTime(g, rates(), {}).maxTimeMin).toBe(Infinity);
    expect(arrivalTime(g, rates(), { maxTimeMin: Infinity }).maxTimeMin).toBe(Infinity);
  });
});

describe('arrivalTime input checks', () => {
  const g = gridOf(['.', 'O', 'P', 'S']);
  const good = rates({ resistSelectivity: 2, siSelectivity: 2 });

  it.each([4, 7, 255])('rejects an unknown material code %i anywhere in the grid', (code) => {
    for (const at of [0, 1, 3]) {
      const materials = g.materials.slice();
      materials[at] = code;
      expect(() => arrivalTime({ ...g, materials }, good)).toThrow(RangeError);
    }
  });

  it('accepts every known material code', () => {
    expect(() => arrivalTime(g, good)).not.toThrow();
  });

  const ok = { verticalNmPerMin: 100, lateralNmPerMin: 20, resistSelectivity: 3, siSelectivity: 8 };
  it.each([
    ['vertical rate 0', { verticalNmPerMin: 0 }],
    ['negative vertical rate', { verticalNmPerMin: -1 }],
    ['NaN vertical rate', { verticalNmPerMin: Number.NaN }],
    ['infinite vertical rate', { verticalNmPerMin: Infinity }],
    ['negative lateral rate', { lateralNmPerMin: -0.1 }],
    ['NaN lateral rate', { lateralNmPerMin: Number.NaN }],
    ['infinite lateral rate', { lateralNmPerMin: Infinity }],
    ['resist selectivity 0', { resistSelectivity: 0 }],
    ['negative resist selectivity', { resistSelectivity: -2 }],
    ['NaN resist selectivity', { resistSelectivity: Number.NaN }],
    ['silicon selectivity 0', { siSelectivity: 0 }],
    ['negative silicon selectivity', { siSelectivity: -1 }],
    ['NaN silicon selectivity', { siSelectivity: Number.NaN }],
  ])('rejects %s', (_name, bad) => {
    expect(() => arrivalTime(g, { ...rates(), ...ok, ...bad })).toThrow(RangeError);
  });

  it('accepts a lateral rate of 0 and selectivities of Infinity', () => {
    expect(() => arrivalTime(g, { ...rates(), ...ok, lateralNmPerMin: 0 })).not.toThrow();
    expect(() =>
      arrivalTime(g, { ...rates(), ...ok, resistSelectivity: Infinity, siSelectivity: Infinity }),
    ).not.toThrow();
  });
});
