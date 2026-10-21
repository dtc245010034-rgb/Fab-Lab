/**
 * Overlay between two layers (M03, step 3.7). The second mask lands on the wafer shifted by
 * (dx, dy) and turned by a small angle θ about the wafer centre; the error at a point (x, y) of
 * the wafer is the shift plus the displacement of the turn, which grows with the distance from
 * the centre:
 *
 *   ex = dx − θ·y,    ey = dy + θ·x
 *
 * Units: errors in nm, positions in mm, the angle in µrad, so that 1 µrad × 1 mm = 1 nm and no
 * conversion factor is needed. A positive angle turns counter-clockwise. The small-angle form is
 * exact to far better than the other approximations here (θ is a few µrad).
 *
 * Pure functions; every coefficient is in constants.ts (tier C). Who has what misplacement (the
 * hidden one, the seed, the learner's corrections) is decided in sim/, not here.
 */
import { constants } from './constants';

const { toleranceFractionOfCd, marginalFactor } = constants.litho.overlay;
const { waferRadiusMm } = constants.geometry;

/** How the mask of the second layer sits on the wafer. */
export interface Alignment {
  dxNm: number;
  dyNm: number;
  /** Rotation about the wafer centre, µrad. */
  rotationUrad: number;
}

/** A point on the wafer, mm from its centre. */
export interface Site {
  xMm: number;
  yMm: number;
}

export interface OverlayError {
  exNm: number;
  eyNm: number;
  magnitudeNm: number;
}

export type OverlayVerdict = 'ok' | 'marginal' | 'fail';

export interface Landing {
  /** Width of the window that still falls on the region below it, nm. */
  coveredNm: number;
  /** coveredNm / windowNm, 0 to 1. */
  coverage: number;
  /** The whole window falls on the region below it. */
  landed: boolean;
}

function assertFinite(name: string, value: number): void {
  if (!Number.isFinite(value))
    throw new RangeError(`${name} must be a finite number, got ${value}`);
}

function assertPositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number, got ${value}`);
  }
}

/** Overlay error of the second layer against the first at one site. */
export function overlayErrorAt(alignment: Alignment, site: Site): OverlayError {
  const { dxNm, dyNm, rotationUrad } = alignment;
  assertFinite('dxNm', dxNm);
  assertFinite('dyNm', dyNm);
  assertFinite('rotationUrad', rotationUrad);
  assertFinite('xMm', site.xMm);
  assertFinite('yMm', site.yMm);
  const exNm = dxNm - rotationUrad * site.yMm;
  const eyNm = dyNm + rotationUrad * site.xMm;
  return { exNm, eyNm, magnitudeNm: Math.sqrt(exNm * exNm + eyNm * eyNm) };
}

/** The wafer centre and four points on the rim, centre first: where overlay is read. */
export function measurementSites(radiusMm: number = waferRadiusMm.value): Site[] {
  assertPositive('radiusMm', radiusMm);
  return [
    { xMm: 0, yMm: 0 },
    { xMm: radiusMm, yMm: 0 },
    { xMm: -radiusMm, yMm: 0 },
    { xMm: 0, yMm: radiusMm },
    { xMm: 0, yMm: -radiusMm },
  ];
}

/** The largest overlay error over the sites, nm. */
export function worstOverlayNm(
  alignment: Alignment,
  sites: readonly Site[] = measurementSites(),
): number {
  if (sites.length === 0) throw new RangeError('worstOverlayNm needs at least one site');
  let worst = 0;
  for (const site of sites) worst = Math.max(worst, overlayErrorAt(alignment, site).magnitudeNm);
  return worst;
}

/** How much layer-to-layer misplacement a feature of this printed width can take, nm. */
export function overlayToleranceNm(cdNm: number): number {
  assertPositive('cdNm', cdNm);
  return toleranceFractionOfCd.value * cdNm;
}

/** ok up to the tolerance, marginal up to `marginalFactor` times it, fail beyond. */
export function overlayVerdict(worstNm: number, cdNm: number): OverlayVerdict {
  if (!Number.isFinite(worstNm) || worstNm < 0) {
    throw new RangeError(`worstNm must be a finite number ≥ 0, got ${worstNm}`);
  }
  const tolerance = overlayToleranceNm(cdNm);
  if (worstNm <= tolerance) return 'ok';
  return worstNm <= tolerance * marginalFactor.value ? 'marginal' : 'fail';
}

/**
 * Does a window printed `offsetNm` off its place still land on the region below it? That region is
 * the window itself plus `marginNm` on each side, so a shift within the margin keeps the whole
 * window on it, and past the margin contact is lost nm for nm until none is left.
 */
export function contactLanding(args: {
  windowNm: number;
  offsetNm: number;
  marginNm: number;
}): Landing {
  const { windowNm, offsetNm, marginNm } = args;
  assertPositive('windowNm', windowNm);
  assertFinite('offsetNm', offsetNm);
  if (!Number.isFinite(marginNm) || marginNm < 0) {
    throw new RangeError(`marginNm must be a finite number ≥ 0, got ${marginNm}`);
  }

  const landed = Math.abs(offsetNm) <= marginNm;
  const half = windowNm / 2;
  const reach = half + marginNm;
  const coveredNm = landed
    ? windowNm
    : Math.max(0, Math.min(offsetNm + half, reach) - Math.max(offsetNm - half, -reach));
  return { coveredNm, coverage: coveredNm / windowNm, landed };
}
