import { describe, expect, it } from 'vitest';
import { erf, erfc, erfinv } from '../../src/physics/special';

/** Relative difference, for values whose size spans many decades. */
const rel = (actual: number, expected: number) => Math.abs(actual - expected) / Math.abs(expected);

describe('erf', () => {
  // Reference values of the mathematical function (to the digits given).
  it.each([
    [0, 0],
    [0.5, 0.5204998778130465],
    [1, 0.8427007929497149],
    [2, 0.9953222650189527],
    [3, 0.9999779095030014],
  ])('erf(%d) = %d', (x, expected) => {
    expect(Math.abs(erf(x) - expected)).toBeLessThan(1e-14);
  });

  it('is odd: erf(−x) = −erf(x), exactly', () => {
    for (const x of [0.01, 0.3, 1, 1.7, 2.5, 4, 7]) expect(erf(-x)).toBe(-erf(x));
  });

  it('rises strictly from −1 to 1 over the range the model uses', () => {
    let previous = erf(-5);
    for (let x = -4.95; x <= 5; x += 0.05) {
      const v = erf(x);
      expect(v, `x=${x}`).toBeGreaterThan(previous);
      previous = v;
    }
  });

  it('saturates at ±1 for large arguments and stays finite', () => {
    expect(erf(8)).toBe(1);
    expect(erf(-8)).toBe(-1);
    expect(erf(Infinity)).toBe(1);
    expect(erf(-Infinity)).toBe(-1);
  });

  it('is continuous where the implementation changes method (x ≈ 2.5)', () => {
    // The true slope at 2.5 is 2/√π·e^(−6.25) ≈ 2.2e-3, so a 2e-12 step moves erf by ≈ 4.4e-15.
    // A seam between the two methods would show up as a jump far above that.
    expect(Math.abs(erf(2.5 + 1e-12) - erf(2.5 - 1e-12))).toBeLessThan(1e-13);
    expect(Math.abs(erfc(2.5 + 1e-12) - erfc(2.5 - 1e-12))).toBeLessThan(1e-13);
  });

  it('propagates NaN', () => {
    expect(erf(Number.NaN)).toBeNaN();
  });
});

describe('erfc', () => {
  it.each([
    [0.5, 0.4795001221869535],
    [3, 2.209049699858544e-5],
    [4, 1.541725790028002e-8],
    [5, 1.5374597944280349e-12],
  ])('erfc(%d) = %d, to 1e-9 relative (no loss of the tail to cancellation)', (x, expected) => {
    expect(rel(erfc(x), expected)).toBeLessThan(1e-9);
  });

  it('satisfies erf(x) + erfc(x) = 1', () => {
    for (const x of [-3, -1, -0.2, 0, 0.4, 1.3, 2.2, 3.1]) {
      expect(Math.abs(erf(x) + erfc(x) - 1)).toBeLessThan(1e-14);
    }
  });

  it('reflects as erfc(−x) = 2 − erfc(x)', () => {
    for (const x of [0.2, 1, 2.4, 3.5]) expect(erfc(-x)).toBeCloseTo(2 - erfc(x), 14);
  });

  it('falls strictly and stays positive out to x = 6', () => {
    let previous = erfc(0);
    for (let x = 0.05; x <= 6; x += 0.05) {
      const v = erfc(x);
      expect(v, `x=${x}`).toBeLessThan(previous);
      expect(v, `x=${x}`).toBeGreaterThan(0);
      previous = v;
    }
  });
});

describe('erfinv', () => {
  it('returns the known value erfinv(0.5) = 0.4769362762044699', () => {
    expect(Math.abs(erfinv(0.5) - 0.4769362762044699)).toBeLessThan(1e-13);
  });

  it('is the inverse of erf over (−1, 1)', () => {
    for (let y = -0.999; y <= 0.9991; y += 0.037) {
      expect(Math.abs(erf(erfinv(y)) - y), `y=${y}`).toBeLessThan(1e-13);
    }
  });

  it('is odd and fixes 0', () => {
    expect(erfinv(0)).toBe(0);
    for (const y of [0.1, 0.5, 0.9, 0.999]) expect(erfinv(-y)).toBe(-erfinv(y));
  });

  it('goes to ±Infinity at ±1', () => {
    expect(erfinv(1)).toBe(Infinity);
    expect(erfinv(-1)).toBe(-Infinity);
  });

  it.each([1.0000001, -1.5, 2, Number.NaN])('rejects %d, which is outside [−1, 1]', (y) => {
    expect(() => erfinv(y)).toThrow(RangeError);
  });
});
