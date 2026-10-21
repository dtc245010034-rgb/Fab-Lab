/**
 * Error function and its relatives, which JavaScript's Math does not have. Pure functions.
 *
 * erf comes from a series of positive terms below SERIES_LIMIT (no cancellation, about 40 terms)
 * and from erfc, a continued fraction, above it (about 1e-16 relative from there on). erfc itself
 * is kept accurate in the tail instead of being computed as 1 − erf, because the aerial image is
 * a difference of two erf values that are both close to 1 far from the feature.
 */

const SERIES_LIMIT = 2.5;
const SERIES_MAX_TERMS = 200;
const FRACTION_TERMS = 40;
const TWO_OVER_SQRT_PI = 2 / Math.sqrt(Math.PI);
const SQRT_PI = Math.sqrt(Math.PI);

/** erf(x) for 0 ≤ x < SERIES_LIMIT: 2/√π · e^(−x²) · Σ 2ⁿ x^(2n+1) / (2n+1)!!. */
function erfSeries(x: number): number {
  let term = x;
  let sum = x;
  for (let n = 1; n < SERIES_MAX_TERMS; n++) {
    term *= (2 * x * x) / (2 * n + 1);
    sum += term;
    if (term < 1e-17 * sum) break;
  }
  return TWO_OVER_SQRT_PI * Math.exp(-x * x) * sum;
}

/** erfc(x) for x ≥ SERIES_LIMIT: e^(−x²)/√π divided by the continued fraction x + (1/2)/(x + 1/(x + …)). */
function erfcFraction(x: number): number {
  let t = x;
  for (let k = FRACTION_TERMS; k >= 1; k--) t = x + k / 2 / t;
  return Math.exp(-x * x) / (SQRT_PI * t);
}

/** Complementary error function, 1 − erf(x), accurate far into the tail. */
export function erfc(x: number): number {
  if (Number.isNaN(x)) return Number.NaN;
  if (x < 0) return 2 - erfc(-x);
  return x < SERIES_LIMIT ? 1 - erfSeries(x) : erfcFraction(x);
}

/** Error function, (2/√π)·∫₀ˣ e^(−t²) dt. Odd, increasing, tends to ±1. */
export function erf(x: number): number {
  if (Number.isNaN(x)) return Number.NaN;
  const a = Math.abs(x);
  const value = a < SERIES_LIMIT ? erfSeries(a) : 1 - erfcFraction(a);
  return x < 0 ? -value : value;
}

/**
 * Inverse of erf on (−1, 1); ±Infinity at ±1. Starts from Winitzki's closed-form estimate and
 * refines with Newton steps. Throws RangeError outside [−1, 1].
 */
export function erfinv(y: number): number {
  if (Number.isNaN(y) || y < -1 || y > 1) {
    throw new RangeError(`erfinv needs a value in [-1, 1], got ${y}`);
  }
  if (y === 0) return 0;
  const a = Math.abs(y);
  if (a === 1) return y > 0 ? Infinity : -Infinity;

  const winitzki = 0.147;
  const ln = Math.log(1 - a * a);
  const u = 2 / (Math.PI * winitzki) + ln / 2;
  let x = Math.sqrt(Math.sqrt(u * u - ln / winitzki) - u);
  for (let i = 0; i < 8; i++) {
    const step = (erf(x) - a) / (TWO_OVER_SQRT_PI * Math.exp(-x * x));
    x -= step;
    if (Math.abs(step) < 1e-15 * (1 + Math.abs(x))) break;
  }
  return y > 0 ? x : -x;
}
