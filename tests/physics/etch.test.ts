import { describe, expect, it } from 'vitest';
import { constants } from '../../src/physics/constants';
import {
  arrivalTime,
  Material,
  rieRates,
  wetEtchRates,
  type EtchRates,
  type MaterialGrid,
} from '../../src/physics/etch';

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

const rates = (over: Partial<EtchRates> = {}): EtchRates => ({
  verticalNmPerMin: 100,
  lateralNmPerMin: 100,
  anisotropy: 0,
  resistSelectivity: Infinity,
  siSelectivity: Infinity,
  ...over,
});

describe('Material', () => {
  it('has four distinct codes with air = 0', () => {
    const codes = Object.values(Material);
    expect(new Set(codes).size).toBe(4);
    expect(Material.AIR).toBe(0);
  });
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
    const t = arrivalTime(g, rates({ verticalNmPerMin: 100, lateralNmPerMin: 100 }));
    expect(t.length).toBe(5);
    expect(t[0]).toBe(0);
    for (let k = 1; k <= 4; k++) expect(t[k]!).toBeCloseTo((k * 10) / 100, 12);
  });

  it('goes up at the lateral rate, not the vertical rate', () => {
    const g = gridOf(['O', 'O', 'O', '.']);
    const t = arrivalTime(g, rates({ verticalNmPerMin: 100, lateralNmPerMin: 20 }));
    expect(t[2]!).toBeCloseTo(10 / 20, 12);
    expect(t[1]!).toBeCloseTo(20 / 20, 12);
    expect(t[0]!).toBeCloseTo(30 / 20, 12);
  });

  it('goes sideways at the lateral rate: d cells from an air face take d·cell/lateral', () => {
    const g = gridOf(['..OOOOOO', '..OOOOOO', '..OOOOOO']);
    const t = arrivalTime(g, rates({ verticalNmPerMin: 100, lateralNmPerMin: 25 }));
    const midRow = 1 * 8;
    for (let d = 1; d <= 6; d++) expect(t[midRow + 1 + d]!).toBeCloseTo((d * 10) / 25, 12);
  });

  it('scales with the cell size (nm) and inversely with the rate (nm/min)', () => {
    const rows = ['.', 'O', 'O'];
    const a = arrivalTime(gridOf(rows, 10), rates({ verticalNmPerMin: 100 }));
    const b = arrivalTime(gridOf(rows, 20), rates({ verticalNmPerMin: 100 }));
    const c = arrivalTime(gridOf(rows, 10), rates({ verticalNmPerMin: 50 }));
    expect(b[2]!).toBeCloseTo(2 * a[2]!, 12);
    expect(c[2]!).toBeCloseTo(2 * a[2]!, 12);
  });

  it('slows down in a material by its selectivity, and never enters one that is not attacked', () => {
    const rows = ['.', 'P', 'P', 'S', 'S'];
    const slow = arrivalTime(gridOf(rows), rates({ resistSelectivity: 4, siSelectivity: 10 }));
    expect(slow[1]!).toBeCloseTo((10 * 4) / 100, 12);
    expect(slow[2]!).toBeCloseTo((2 * 10 * 4) / 100, 12);
    expect(slow[3]!).toBeCloseTo((2 * 10 * 4) / 100 + (10 * 10) / 100, 12);
    const blocked = arrivalTime(gridOf(rows), rates());
    expect(blocked[1]).toBe(Infinity);
    expect(blocked[3]).toBe(Infinity);
  });

  it('with zero lateral rate only moves straight down, so cells beside a window stay untouched', () => {
    const g = gridOf(['..OO', 'OOOO', 'OOOO']);
    const t = arrivalTime(g, rates({ lateralNmPerMin: 0, anisotropy: 1 }));
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
    const t = arrivalTime(
      gridOf(rows, cell),
      rates({ verticalNmPerMin: rate, lateralNmPerMin: rate }),
    );
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
    const a = arrivalTime(gridOf(rows), r);
    const b = arrivalTime(gridOf(mirrored), r);
    const w = rows[0]!.length;
    for (let y = 0; y < rows.length; y++) {
      for (let x = 0; x < w; x++) expect(a[y * w + x]!).toBeCloseTo(b[y * w + (w - 1 - x)]!, 12);
    }
  });

  it('rejects a grid whose arrays do not match its dimensions or has a non-positive cell size', () => {
    const g = gridOf(['.', 'O']);
    expect(() => arrivalTime({ ...g, widthCells: 3 }, rates())).toThrow(RangeError);
    expect(() => arrivalTime({ ...g, cellNm: 0 }, rates())).toThrow(RangeError);
  });
});
