import { describe, expect, it } from 'vitest';
import { blurSigmaNm, dofNm, slitEdgeHalfWidthNm, slitIntensity } from '../../src/physics/aerial';
import { constants, type LightSourceId } from '../../src/physics/constants';
import { erf } from '../../src/physics/special';

const SOURCES: LightSourceId[] = ['g', 'i', 'krf', 'arf'];
const { k2 } = constants.litho;
const sigma0Factor = constants.litho.exposure.blurAtBestFocus.value;
const lambdaOverNa = (id: LightSourceId) => {
  const s = constants.litho.sources[id];
  return s.wavelengthNm.value / s.na.value;
};

describe('dofNm (DOF = k₂·λ/NA²)', () => {
  it.each(SOURCES)('equals k₂·λ/NA² for source %s', (id) => {
    const s = constants.litho.sources[id];
    const expected = (k2.value * s.wavelengthNm.value) / (s.na.value * s.na.value);
    expect(dofNm(id)).toBeCloseTo(expected, 9);
  });

  it('shrinks with each shorter-wavelength, higher-NA source: the price of resolution', () => {
    const dof = SOURCES.map(dofNm);
    for (let i = 1; i < dof.length; i++) expect(dof[i]!).toBeLessThan(dof[i - 1]!);
  });

  it('obeys the NA² law: DOF·NA²/λ is the same constant k₂ for every source', () => {
    // The real sources change wavelength and NA together, so the 1/NA² dependence is checked
    // through this invariant rather than through a ratio of two of them.
    for (const id of SOURCES) {
      const s = constants.litho.sources[id];
      expect((dofNm(id) * s.na.value ** 2) / s.wavelengthNm.value).toBeCloseTo(k2.value, 12);
    }
  });
});

describe('blurSigmaNm (Gaussian width of the aerial image)', () => {
  it.each(SOURCES)('is blurAtBestFocus·λ/NA at best focus for source %s', (id) => {
    expect(blurSigmaNm(id, 0)).toBeCloseTo(sigma0Factor * lambdaOverNa(id), 9);
  });

  it('shrinks with each shorter-wavelength, higher-NA source', () => {
    const sigma = SOURCES.map((id) => blurSigmaNm(id, 0));
    for (let i = 1; i < sigma.length; i++) expect(sigma[i]!).toBeLessThan(sigma[i - 1]!);
  });

  it.each(SOURCES)('is √2 times wider at ±DOF/2 than at best focus (source %s)', (id) => {
    // This is what "the depth of focus" means in this model: the range in which the blur has
    // not grown by more than √2.
    const half = dofNm(id) / 2;
    expect(blurSigmaNm(id, half) / blurSigmaNm(id, 0)).toBeCloseTo(Math.SQRT2, 12);
    expect(blurSigmaNm(id, -half) / blurSigmaNm(id, 0)).toBeCloseTo(Math.SQRT2, 12);
  });

  it('is exactly symmetric about best focus', () => {
    for (const id of SOURCES) {
      for (const dz of [10, 80, 250, 700, 2000]) {
        expect(blurSigmaNm(id, dz), `${id} ±${dz}`).toBe(blurSigmaNm(id, -dz));
      }
    }
  });

  it('grows strictly with |defocus| on both sides', () => {
    for (const id of SOURCES) {
      let right = blurSigmaNm(id, 0);
      let left = right;
      for (let dz = 25; dz <= 1500; dz += 25) {
        const r = blurSigmaNm(id, dz);
        const l = blurSigmaNm(id, -dz);
        expect(r, `${id} +${dz}`).toBeGreaterThan(right);
        expect(l, `${id} −${dz}`).toBeGreaterThan(left);
        right = r;
        left = l;
      }
    }
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects defocus %s',
    (dz) => {
      expect(() => blurSigmaNm('i', dz)).toThrow(RangeError);
    },
  );
});

describe('slitIntensity (a clear slit of width w, blurred by a Gaussian of width σ)', () => {
  const w = 800;
  const sigma = 270;

  it('is mirror-symmetric about the slit centre', () => {
    for (const x of [0, 50, 200, 399, 400, 401, 700, 1500]) {
      expect(slitIntensity(x, w, sigma), `x=${x}`).toBe(slitIntensity(-x, w, sigma));
    }
  });

  it('equals erf(w / (2√2·σ)) at the centre', () => {
    expect(slitIntensity(0, w, sigma)).toBeCloseTo(erf(w / (2 * Math.SQRT2 * sigma)), 14);
  });

  it('stays between 0 and 1', () => {
    for (const s of [20, 120, 270, 600, 1500]) {
      for (let x = 0; x <= 4000; x += 37) {
        const v = slitIntensity(x, w, s);
        expect(v, `σ=${s} x=${x}`).toBeGreaterThanOrEqual(0);
        expect(v, `σ=${s} x=${x}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('falls monotonically away from the centre', () => {
    for (const s of [60, 270, 900]) {
      let previous = slitIntensity(0, w, s);
      for (let x = 10; x <= 3000; x += 10) {
        const v = slitIntensity(x, w, s);
        expect(v, `σ=${s} x=${x}`).toBeLessThanOrEqual(previous);
        previous = v;
      }
    }
  });

  it('is 1 inside and 0 outside a very wide slit, and exactly ½ at its edge', () => {
    const wide = 20000;
    const s = 200;
    expect(slitIntensity(0, wide, s)).toBeCloseTo(1, 12);
    expect(slitIntensity(wide / 2, wide, s)).toBeCloseTo(0.5, 12);
    expect(slitIntensity(wide / 2 + 10 * s, wide, s)).toBeLessThan(1e-12);
  });

  it('approaches the ideal slit as the blur goes to zero', () => {
    expect(slitIntensity(0.9 * (w / 2), w, 1)).toBeCloseTo(1, 12);
    expect(slitIntensity(1.1 * (w / 2), w, 1)).toBeLessThan(1e-12);
  });

  it('keeps the total light: blurring moves it around but does not remove it (∫I dx = w)', () => {
    for (const s of [40, 270, 800]) {
      const reach = w / 2 + 10 * s;
      const n = 20000;
      const dx = (2 * reach) / n;
      let area = 0;
      for (let i = 0; i <= n; i++) {
        const weight = i === 0 || i === n ? 0.5 : 1;
        area += weight * slitIntensity(-reach + i * dx, w, s) * dx;
      }
      expect(area, `σ=${s}`).toBeCloseTo(w, 3);
    }
  });

  it('lowers the centre intensity as the blur grows', () => {
    let previous = slitIntensity(0, w, 10);
    for (let s = 50; s <= 2000; s += 50) {
      const v = slitIntensity(0, w, s);
      expect(v, `σ=${s}`).toBeLessThan(previous);
      previous = v;
    }
  });

  it('keeps full relative accuracy far from the slit, where both erf terms are close to 1', () => {
    // 6σ beyond the edge: the true value is erfc(6/√2)/2 ≈ 9.9e-10. A difference of two erf()
    // values would lose all digits here.
    const x = w / 2 + 6 * sigma;
    const v = slitIntensity(x, w, sigma);
    expect(v).toBeGreaterThan(9e-10);
    expect(v).toBeLessThan(1.1e-9);
  });

  it.each([
    { x: Number.NaN, w: 800, s: 270 },
    { x: 0, w: 0, s: 270 },
    { x: 0, w: -5, s: 270 },
    { x: 0, w: 800, s: 0 },
    { x: 0, w: 800, s: -1 },
    { x: 0, w: Number.NaN, s: 270 },
    { x: 0, w: 800, s: Number.POSITIVE_INFINITY },
  ])('rejects invalid input %o', ({ x, w: width, s }) => {
    expect(() => slitIntensity(x, width, s)).toThrow(RangeError);
  });
});

describe('slitEdgeHalfWidthNm (where the blurred slit crosses a given intensity)', () => {
  const w = 800;
  const sigma = 270;
  const centre = () => slitIntensity(0, w, sigma);

  it('returns the x ≥ 0 at which the intensity equals the level', () => {
    for (const level of [0.02, 0.1, 0.25, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.97, 0.99]) {
      if (level >= centre()) continue;
      const x = slitEdgeHalfWidthNm(level, w, sigma);
      expect(slitIntensity(x, w, sigma), `level=${level}`).toBeCloseTo(level, 10);
    }
  });

  it('puts the ½ level exactly at the nominal edge for a slit much wider than the blur', () => {
    expect(slitEdgeHalfWidthNm(0.5, 20000, 200)).toBeCloseTo(10000, 6);
  });

  it('moves outwards as the level falls: a lower threshold opens a wider window', () => {
    let previous = slitEdgeHalfWidthNm(centre() * 0.999, w, sigma);
    for (let level = centre() * 0.95; level > 0.01; level -= 0.03) {
      const x = slitEdgeHalfWidthNm(level, w, sigma);
      expect(x, `level=${level}`).toBeGreaterThan(previous);
      previous = x;
    }
  });

  it('returns 0 when the level is not reached anywhere, i.e. nothing opens', () => {
    expect(slitEdgeHalfWidthNm(centre(), w, sigma)).toBe(0);
    expect(slitEdgeHalfWidthNm(centre() + 0.01, w, sigma)).toBe(0);
    expect(slitEdgeHalfWidthNm(1, w, sigma)).toBe(0);
  });

  it('returns a finite cap beyond the slit when the level is at or below 0 (everything opens)', () => {
    const cap = slitEdgeHalfWidthNm(0, w, sigma);
    expect(Number.isFinite(cap)).toBe(true);
    expect(cap).toBeGreaterThan(w / 2 + 5 * sigma);
    expect(slitEdgeHalfWidthNm(-0.3, w, sigma)).toBe(cap);
  });

  it('widens with the blur below the ½ level (the tail grows), narrows with it above ½ (the shoulder is eaten)', () => {
    expect(slitEdgeHalfWidthNm(0.2, w, 400)).toBeGreaterThan(slitEdgeHalfWidthNm(0.2, w, 150));
    expect(slitEdgeHalfWidthNm(0.8, w, 150)).toBeLessThan(slitEdgeHalfWidthNm(0.8, w, 100));
  });

  it('does not depend on the blur at the ½ level for a slit much wider than the blur', () => {
    const wide = 20000;
    expect(slitEdgeHalfWidthNm(0.5, wide, 100)).toBeCloseTo(slitEdgeHalfWidthNm(0.5, wide, 600), 6);
  });

  it.each([
    { level: Number.NaN, w: 800, s: 270 },
    { level: 0.5, w: 0, s: 270 },
    { level: 0.5, w: 800, s: 0 },
    { level: 0.5, w: Number.NaN, s: 270 },
  ])('rejects invalid input %o', ({ level, w: width, s }) => {
    expect(() => slitEdgeHalfWidthNm(level, width, s)).toThrow(RangeError);
  });
});
