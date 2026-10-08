import { describe, expect, it } from 'vitest';
import { constants } from '../../src/physics/constants';
import {
  minFeatureNm,
  printLitho,
  resistThicknessNm,
  type LightSourceId,
  type LithoInput,
} from '../../src/physics/litho';

const SOURCES: LightSourceId[] = ['g', 'i', 'krf', 'arf'];

/** Defaults of the M04 start condition: 3000 rpm, i-line, 800 nm window, dose ×1. */
const base: LithoInput = { spinRpm: 3000, source: 'i', designNm: 800, dose: 1 };
const print = (over: Partial<LithoInput> = {}) => printLitho({ ...base, ...over });

const range = (from: number, to: number, step: number) => {
  const out: number[] = [];
  for (let v = from; v <= to + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
};

describe('resistThicknessNm (spin coat, t ∝ ω^-1/2)', () => {
  it('returns the reference thickness at the reference spin speed', () => {
    expect(resistThicknessNm(constants.litho.resistRefSpinRpm.value)).toBe(
      constants.litho.resistRefThicknessNm.value,
    );
  });

  it('gets thinner as the wafer spins faster', () => {
    const speeds = range(1500, 6000, 250);
    const t = speeds.map(resistThicknessNm);
    for (let i = 1; i < t.length; i++) expect(t[i]!).toBeLessThan(t[i - 1]!);
  });

  it('follows the inverse-square-root law: 4× the speed halves the thickness (±rounding)', () => {
    expect(Math.abs(resistThicknessNm(1500) - 2 * resistThicknessNm(6000))).toBeLessThanOrEqual(2);
  });

  it.each([0, -100, Number.NaN, Number.POSITIVE_INFINITY])('rejects spin speed %s', (rpm) => {
    expect(() => resistThicknessNm(rpm)).toThrow(RangeError);
  });
});

describe('minFeatureNm (CD_min = k1·λ/NA)', () => {
  it.each(SOURCES)('equals k1·λ/NA for source %s', (id) => {
    const s = constants.litho.sources[id];
    expect(minFeatureNm(id)).toBe((constants.litho.k1.value * s.wavelengthNm.value) / s.na.value);
  });

  it('shrinks with each shorter-wavelength, higher-NA source', () => {
    const cd = SOURCES.map(minFeatureNm);
    for (let i = 1; i < cd.length; i++) expect(cd[i]!).toBeLessThan(cd[i - 1]!);
  });
});

describe('printLitho', () => {
  it('prints a well-resolved window at design size, with no scum, no taper, no flags', () => {
    const r = print();
    expect(r.printedNm).toBe(800);
    expect(r.scumNm).toBe(0);
    expect(r.taperNm).toBe(0);
    expect(r.status).toBe('ok');
    expect(r.flags).toEqual([]);
  });

  it('reports the numbers an explanation needs', () => {
    const r = print({ designNm: 300 });
    expect(r.cdMinNm).toBe(minFeatureNm('i'));
    expect(r.ratio).toBeCloseTo(300 / minFeatureNm('i'), 12);
    expect(r.resistThicknessNm).toBe(resistThicknessNm(3000));
    expect(r.designNm).toBe(300);
    expect(r.printedNm).toBeGreaterThan(0);
    expect(r.scumNm).toBeGreaterThan(0);
  });

  it('opens nothing when the window is far below the resolution limit', () => {
    const r = print({ designNm: 150 }); // ratio ≈ 0.41 on i-line
    expect(r.printedNm).toBe(0);
    expect(r.scumNm).toBe(r.resistThicknessNm);
    expect(r.status).toBe('fail');
    expect(r.flags).toContain('below-resolution');
  });

  it('prints a narrower, scummed window near the resolution limit', () => {
    const r = print({ designNm: 300 }); // ratio ≈ 0.82 on i-line
    expect(r.printedNm).toBeGreaterThan(0);
    expect(r.printedNm).toBeLessThan(300);
    expect(r.scumNm).toBeGreaterThan(0);
    expect(r.status).toBe('marginal');
    expect(r.flags).toContain('near-resolution');
  });

  it('is monotone: a larger design window never prints narrower', () => {
    for (const source of SOURCES) {
      const printed = range(150, 1200, 50).map((designNm) => print({ source, designNm }).printedNm);
      for (let i = 1; i < printed.length; i++) {
        expect(printed[i]!, `${source} @${150 + 50 * i} nm`).toBeGreaterThanOrEqual(
          printed[i - 1]!,
        );
      }
    }
  });

  it('is monotone: a shorter-wavelength source never prints a small window worse', () => {
    const printed = SOURCES.map((source) => print({ source, designNm: 300 }).printedNm);
    for (let i = 1; i < printed.length; i++) {
      expect(printed[i]!).toBeGreaterThanOrEqual(printed[i - 1]!);
    }
  });

  it('widens the printed window as dose rises, and flags overdose above the threshold', () => {
    const doses = range(0.85, 1.6, 0.05);
    const printed = doses.map((dose) => print({ dose }).printedNm);
    for (let i = 1; i < printed.length; i++) expect(printed[i]!).toBeGreaterThan(printed[i - 1]!);
    expect(print({ dose: 1.35 }).flags).not.toContain('overdose');
    expect(print({ dose: 1.4 }).flags).toContain('overdose');
    expect(print({ dose: 1.4 }).status).toBe('marginal');
  });

  it('leaves more scum the lower the dose, and none at or above the underdose threshold', () => {
    const doses = range(0.6, 1.2, 0.05);
    const scum = doses.map((dose) => print({ dose }).scumNm);
    for (let i = 1; i < scum.length; i++) expect(scum[i]!).toBeLessThanOrEqual(scum[i - 1]!);
    expect(print({ dose: 0.7 }).scumNm).toBeGreaterThan(0);
    expect(print({ dose: 0.7 }).flags).toContain('underdose');
    const atThreshold = print({ dose: constants.litho.underdoseBelowDose.value });
    expect(atThreshold.scumNm).toBe(0);
    expect(atThreshold.flags).not.toContain('underdose');
    expect(atThreshold.status).toBe('ok');
  });

  it('has no sidewall taper once the window is comfortably resolved, more taper the closer to the limit', () => {
    expect(print({ designNm: 800 }).taperNm).toBe(0);
    const taper = range(300, 800, 50).map((designNm) => print({ designNm }).taperNm);
    for (let i = 1; i < taper.length; i++) expect(taper[i]!).toBeLessThanOrEqual(taper[i - 1]!);
    expect(print({ designNm: 400 }).taperNm).toBeGreaterThan(0);
  });

  it('keeps scum within the resist thickness and the printed width non-negative', () => {
    for (const source of SOURCES) {
      for (const spinRpm of [1500, 3000, 6000]) {
        for (const designNm of range(150, 1200, 150)) {
          for (const dose of [0.6, 0.8, 1, 1.4, 1.6]) {
            const r = printLitho({ spinRpm, source, designNm, dose });
            const tag = JSON.stringify({ spinRpm, source, designNm, dose });
            expect(r.scumNm, tag).toBeGreaterThanOrEqual(0);
            expect(r.scumNm, tag).toBeLessThanOrEqual(r.resistThicknessNm);
            expect(r.printedNm, tag).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });

  it('raises status "fail" only for a window below the resolution limit', () => {
    for (const designNm of range(150, 1200, 50)) {
      const r = print({ designNm });
      expect(r.status === 'fail', `${designNm} nm`).toBe(r.flags.includes('below-resolution'));
    }
  });

  it.each([
    { designNm: 0 },
    { designNm: -50 },
    { dose: 0 },
    { dose: -1 },
    { spinRpm: 0 },
    { designNm: Number.NaN },
    { dose: Number.NaN },
  ])('rejects invalid input %o', (over) => {
    expect(() => print(over)).toThrow(RangeError);
  });
});
