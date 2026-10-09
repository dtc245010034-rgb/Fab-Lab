/**
 * M04 acceptance tests: the 3 regression cases of docs/modules/m04-etch.md and the qualitative laws
 * of docs/SCIENCE.md §5. Every case uses 3000 rpm (500 nm resist), i-line, dose ×1 and the default
 * 260×150 grid at 10 nm per cell; only the window and the etch recipe change.
 */
import { describe, expect, it } from 'vitest';
import { rieRates } from '../../src/physics/etch';
import { BASE_LITHO, centreDepthNm, rie, simulate, wet, type EtchStep } from './helpers';

const CELL = 10;
/** One cell of discretisation error, plus float noise (never ride the boundary exactly). */
const ONE_CELL = CELL + 1e-6;

const run = (designNm: number, etch: EtchStep, litho = {}) =>
  simulate({ litho: { ...BASE_LITHO, designNm, ...litho }, etch });

const near = (label: string, actual: number, expected: number, tol: number) =>
  expect(
    Math.abs(actual - expected),
    `${label}: got ${actual}, want ${expected} ±${tol}`,
  ).toBeLessThanOrEqual(tol);

const range = (from: number, to: number, step: number) => {
  const out: number[] = [];
  for (let v = from; v <= to + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
};

describe('regression cases of m04-etch.md (±20 nm, ±2°)', () => {
  it('A: wet BOE 6:1, 3.3 min, 800 nm window → undercut equals the etch front, 56° wall', () => {
    const { metrics: m } = run(800, wet('boe6', 3.3));
    expect(m.cleared).toBe(true);
    near('bottom', m.bottomNm, 1040, 20);
    near('top', m.topNm, 1440, 20);
    near('undercut', m.undercutNm, 320, 20);
    near('angle', m.sidewallAngleDeg, 56, 2);
  });

  it('B: RIE 200 W, 30 mTorr, 4.6 min, 800 nm window → nearly vertical wall', () => {
    const { metrics: m } = run(800, rie(200, 30, 4.6));
    expect(m.cleared).toBe(true);
    near('top', m.topNm, 820, 20);
    near('bottom', m.bottomNm, 800, 20);
    near('angle', m.sidewallAngleDeg, 88, 2);
  });

  it('C: RIE 80 W, 180 mTorr, 9 min, 400 nm window → sloped wall with large undercut', () => {
    const { metrics: m } = run(400, rie(80, 180, 9));
    expect(m.cleared).toBe(true);
    near('undercut', m.undercutNm, 260, 20);
    near('angle', m.sidewallAngleDeg, 68, 2);
  });
});

describe('SCIENCE.md §5: RIE pressure', () => {
  it('raising chamber pressure never reduces undercut and never steepens the wall', () => {
    for (const powerW of [100, 200, 300]) {
      // 20 % over-etch through the 300 nm oxide; pressure does not change the vertical rate.
      const timeMin = (1.2 * 300) / rieRates({ powerW, pressureMTorr: 30 }).verticalNmPerMin;
      const sims = range(10, 200, 10).map((p) => run(800, rie(powerW, p, timeMin)));
      sims.forEach((s, i) => {
        expect(s.metrics.cleared, `${powerW} W @${10 + 10 * i} mTorr`).toBe(true);
        if (i === 0) return;
        const tag = `${powerW} W: ${10 * i} → ${10 + 10 * i} mTorr`;
        expect(s.metrics.undercutNm, tag).toBeGreaterThanOrEqual(sims[i - 1]!.metrics.undercutNm);
        expect(s.metrics.sidewallAngleDeg, tag).toBeLessThanOrEqual(
          sims[i - 1]!.metrics.sidewallAngleDeg + 1e-9,
        );
      });
      expect(sims.at(-1)!.metrics.undercutNm).toBeGreaterThan(sims[0]!.metrics.undercutNm);
    }
  });
});

describe('SCIENCE.md §5: wet etch is isotropic, undercut ≈ depth', () => {
  const etchants = [
    ['boe10', 50],
    ['boe6', 100],
    ['hf49', 2000],
  ] as const;
  // Distances chosen at 5 mod 10 nm so that no cell sits exactly on the arrival-time threshold.
  const distances = [55, 125, 185, 235, 285];

  it('the etch front is where rate × time says it is (within one cell)', () => {
    for (const [etchant, rate] of etchants) {
      for (const dist of distances) {
        const s = run(800, wet(etchant, dist / rate));
        const depth = centreDepthNm(s);
        expect(depth, `${etchant} ${dist} nm`).toBeLessThanOrEqual(dist);
        expect(dist - depth, `${etchant} ${dist} nm`).toBeLessThan(CELL);
      }
    }
  });

  it('undercut equals the etch depth to within one cell', () => {
    // The off-by-one cell is discretisation, not physics: the first step from the air cell into
    // the oxide costs a whole cell before any sideways travel starts, so on the grid
    // undercut = depth − 1 cell.
    for (const [etchant, rate] of etchants) {
      for (const dist of distances) {
        const s = run(800, wet(etchant, dist / rate));
        const tag = `${etchant} ${dist} nm`;
        expect(Math.abs(s.metrics.undercutNm - centreDepthNm(s)), tag).toBeLessThanOrEqual(
          ONE_CELL,
        );
        // Against the raw rate × time the error can reach two cells (the one above plus rounding
        // the front down to a whole cell).
        expect(Math.abs(s.metrics.undercutNm - dist), tag).toBeLessThanOrEqual(2 * CELL + 1e-6);
      }
    }
  });

  it('undercut grows at the etch rate: Δundercut ≈ rate × Δtime (within one cell)', () => {
    const pairs = [
      [45, 145],
      [23, 171],
      [88, 262],
      [131, 284],
      // Across break-through of the 300 nm oxide. 395 nm of BOE 10:1 is 7.9 min: the pair used to
      // end at 417 nm (8.34 min), beyond the 8 min the time control offers, which the app refuses.
      [233, 395],
    ] as const;
    for (const [etchant, rate] of etchants) {
      for (const [d1, d2] of pairs) {
        const u1 = run(800, wet(etchant, d1 / rate)).metrics.undercutNm;
        const u2 = run(800, wet(etchant, d2 / rate)).metrics.undercutNm;
        expect(Math.abs(u2 - u1 - (d2 - d1)), `${etchant} ${d1}→${d2} nm`).toBeLessThanOrEqual(
          ONE_CELL,
        );
      }
    }
  });

  it('attacks neither resist nor silicon, however long it runs', () => {
    const { metrics: m } = run(800, wet('boe6', 8));
    expect(m.cleared).toBe(true);
    expect(m.siLossNm).toBe(0);
    expect(m.resistLeftNm).toBe(500);
  });

  it('cannot clear scum left by an under-exposed window, because it does not attack resist', () => {
    const s = run(800, wet('boe6', 8), { dose: 0.7 });
    expect(s.litho.scumNm).toBeGreaterThan(0);
    expect(s.metrics.cleared).toBe(false);
    expect(s.metrics.topNm).toBe(0);
  });
});

describe('SCIENCE.md §5: zero time etches nothing', () => {
  it.each([
    ['wet BOE 6:1', wet('boe6', 0)],
    ['RIE', rie(200, 30, 0)],
  ])('%s at t = 0', (_name, etch) => {
    const s = run(800, etch);
    const m = s.metrics;
    expect(m.cleared).toBe(false);
    expect(m.topNm).toBe(0);
    expect(m.bottomNm).toBe(0);
    expect(m.undercutNm).toBe(0);
    expect(m.siLossNm).toBe(0);
    expect(m.sidewallAngleDeg).toBe(0);
    expect(m.resistLeftNm).toBe(s.litho.resistThicknessNm);
    let etched = 0;
    s.section.materials.forEach((material, i) => {
      if (material !== 0 && s.arrival[i]! <= 0) etched++;
    });
    expect(etched).toBe(0);
  });
});

describe('SCIENCE.md §5: the cross-section is symmetric about the window centre', () => {
  const cases: [string, number, EtchStep][] = [
    ['A', 800, wet('boe6', 3.3)],
    ['B', 800, rie(200, 30, 4.6)],
    ['C', 400, rie(80, 180, 9)],
    ['marginal litho', 300, rie(150, 100, 6)],
  ];
  it.each(cases)(
    'case %s: arrival time at x equals arrival time at the mirrored cell',
    (_n, w, etch) => {
      const { section, arrival } = run(w, etch);
      const width = section.widthCells;
      let worst = 0;
      for (let y = 0; y < section.heightCells; y++) {
        for (let x = 0; x < width; x++) {
          const a = arrival[y * width + x]!;
          const b = arrival[y * width + (width - 1 - x)]!;
          if (a === b) continue; // equal, including both unreachable
          worst = Math.max(worst, Math.abs(a - b));
        }
      }
      expect(worst).toBeLessThanOrEqual(1e-12);
    },
  );
});

describe('time is monotone', () => {
  it.each([
    ['wet BOE 6:1', (t: number) => wet('boe6', t), range(0, 6, 0.5)],
    ['RIE 200 W / 60 mTorr', (t: number) => rie(200, 60, t), range(0, 8, 0.5)],
  ])('%s: longer etch never shrinks undercut, top width or depth', (_n, step, times) => {
    const sims = times.map((t) => run(800, step(t)));
    for (let i = 1; i < sims.length; i++) {
      const tag = `${times[i - 1]} → ${times[i]} min`;
      expect(sims[i]!.metrics.undercutNm, tag).toBeGreaterThanOrEqual(
        sims[i - 1]!.metrics.undercutNm,
      );
      expect(sims[i]!.metrics.topNm, tag).toBeGreaterThanOrEqual(sims[i - 1]!.metrics.topNm);
      expect(centreDepthNm(sims[i]!), tag).toBeGreaterThanOrEqual(centreDepthNm(sims[i - 1]!));
    }
  });
});

describe('RIE through scum', () => {
  it('eats through resist scum that wet etching cannot, given enough time', () => {
    const s = run(800, rie(250, 30, 12), { dose: 0.7 });
    expect(s.litho.scumNm).toBeGreaterThan(0);
    expect(s.metrics.cleared).toBe(true);
  });
});
