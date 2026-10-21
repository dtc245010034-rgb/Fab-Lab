/**
 * Aerial image of M03: how light from a clear slit on the mask lands on the resist after the
 * lens. One dimension (x across the slit), a Gaussian blur, no diffraction orders. The blur σ is
 * an *effective* one: it lumps the optics and the spread of the exposure inside the resist, and is
 * not the point spread function of a lens (it comes out about twice as wide as a Gaussian fitted
 * to an Airy disk, ≈ 0.21·λ/NA).
 * Model of docs/SCIENCE.md §2 M03; every coefficient is in constants.ts (tier C).
 *
 *   CD_min = k₁·λ/NA   (minFeatureNm in litho.ts, kept for M04)
 *   DOF    = k₂·λ/NA²
 *   σ(Δz)  = σ₀·√(1 + (2Δz/DOF)²),   σ₀ = blurAtBestFocus·λ/NA
 *
 * The √(1+…) form is the convention that DEFINES the depth of focus here: at Δz = ±DOF/2 the blur
 * has grown by exactly √2. Blur depends on Δz², so the model is symmetric about best focus.
 *
 * This single-slit image has no hard resolution limit: with enough dose, however small the slit,
 * something opens. A real limit comes from diffraction of a line pattern at a given pitch, which
 * this model leaves out.
 */
import { constants, type LightSourceId } from './constants';
import { erfc } from './special';

const L = constants.litho;

/** How far past the nominal edge (in σ) the edge search looks; the image is ~1e-15 there. */
const REACH_SIGMA = 8;
const MAX_ITERATIONS = 100;

function assertPositiveFinite(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number, got ${value}`);
  }
}

function sourceOf(id: LightSourceId) {
  const source = L.sources[id];
  if (source === undefined) throw new RangeError(`unknown light source "${String(id)}"`);
  return source;
}

/** Depth of focus DOF = k₂·λ/NA², nm: the focus range over which the blur grows by at most √2. */
export function dofNm(source: LightSourceId): number {
  const { wavelengthNm, na } = sourceOf(source);
  return (L.k2.value * wavelengthNm.value) / (na.value * na.value);
}

/** Gaussian width σ of the aerial image, nm, at a focus offset `defocusNm` (either sign). */
export function blurSigmaNm(source: LightSourceId, defocusNm: number): number {
  if (!Number.isFinite(defocusNm)) {
    throw new RangeError(`defocusNm must be a finite number, got ${defocusNm}`);
  }
  const { wavelengthNm, na } = sourceOf(source);
  const sigma0 = (L.exposure.blurAtBestFocus.value * wavelengthNm.value) / na.value;
  const ratio = (2 * defocusNm) / dofNm(source);
  return sigma0 * Math.sqrt(1 + ratio * ratio);
}

/**
 * Relative intensity at x (nm from the slit centre) for a clear slit of width `widthNm` blurred
 * by a Gaussian of width `sigmaNm`: ½[erf((x+w/2)/(√2σ)) − erf((x−w/2)/(√2σ))]. Written as a
 * difference of erfc so that the far tails keep their digits. 0 to 1, even in x.
 */
export function slitIntensity(xNm: number, widthNm: number, sigmaNm: number): number {
  if (!Number.isFinite(xNm)) throw new RangeError(`xNm must be a finite number, got ${xNm}`);
  assertPositiveFinite('widthNm', widthNm);
  assertPositiveFinite('sigmaNm', sigmaNm);
  const s = Math.SQRT2 * sigmaNm;
  const half = widthNm / 2;
  const x = Math.abs(xNm);
  const value = 0.5 * (erfc((x - half) / s) - erfc((x + half) / s));
  return Math.min(1, Math.max(0, value));
}

/**
 * The x ≥ 0 at which the blurred slit has intensity `level`: the half-width of the window that
 * a threshold at that level opens. The image falls monotonically away from the centre, so the
 * answer is unique.
 *
 *  - level at or above the centre intensity: nothing reaches it, returns 0;
 *  - level so low that the image never drops below it (≤ 0 included): returns the search cap,
 *    `widthNm/2 + 8σ`, i.e. "as wide as the model can say".
 */
export function slitEdgeHalfWidthNm(level: number, widthNm: number, sigmaNm: number): number {
  if (Number.isNaN(level)) throw new RangeError('level must not be NaN');
  assertPositiveFinite('widthNm', widthNm);
  assertPositiveFinite('sigmaNm', sigmaNm);

  const half = widthNm / 2;
  const cap = half + REACH_SIGMA * sigmaNm;
  if (level >= slitIntensity(0, widthNm, sigmaNm)) return 0;
  if (level <= slitIntensity(cap, widthNm, sigmaNm)) return cap;

  const s = Math.SQRT2 * sigmaNm;
  const slope = (x: number) => {
    const a = (x + half) / s;
    const b = (x - half) / s;
    return (Math.exp(-a * a) - Math.exp(-b * b)) / (Math.sqrt(Math.PI) * s); // dI/dx, < 0 for x > 0
  };

  // Newton's method held inside a bracket that always contains the root; falls back to halving.
  let lo = 0; // I(lo) > level
  let hi = cap; // I(hi) < level
  let x = Math.min(half, cap / 2);
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const f = slitIntensity(x, widthNm, sigmaNm) - level;
    if (f > 0) lo = x;
    else hi = x;
    let next = x - f / slope(x);
    if (!(next > lo && next < hi)) next = 0.5 * (lo + hi);
    if (Math.abs(next - x) < 1e-12 * (1 + x)) return next;
    x = next;
  }
  return x;
}
