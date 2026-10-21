import { describe, expect, it } from 'vitest';
import { constants } from '../../src/physics/constants';
import {
  contactLanding,
  measurementSites,
  overlayErrorAt,
  overlayToleranceNm,
  overlayVerdict,
  worstOverlayNm,
  type Alignment,
} from '../../src/physics/overlay';

const R = constants.geometry.waferRadiusMm.value;
const zero: Alignment = { dxNm: 0, dyNm: 0, rotationUrad: 0 };
const align = (over: Partial<Alignment>): Alignment => ({ ...zero, ...over });

describe('overlayErrorAt (mask misplacement: shift plus rotation, errors in nm, sites in mm)', () => {
  it('is the shift itself everywhere when there is no rotation', () => {
    const a = align({ dxNm: 30, dyNm: -40 });
    for (const site of [
      { xMm: 0, yMm: 0 },
      { xMm: R, yMm: 0 },
      { xMm: -R, yMm: 17 },
      { xMm: 12, yMm: -R },
    ]) {
      const e = overlayErrorAt(a, site);
      expect(e.exNm).toBe(30);
      expect(e.eyNm).toBe(-40);
      expect(e.magnitudeNm).toBe(50);
    }
  });

  it('is zero at the centre and proportional to the distance from it when there is only rotation', () => {
    const a = align({ rotationUrad: 2 });
    expect(overlayErrorAt(a, { xMm: 0, yMm: 0 }).magnitudeNm).toBe(0);
    for (const [x, y] of [
      [10, 0],
      [0, 25],
      [30, 40],
      [-60, 80],
    ] as const) {
      const r = Math.hypot(x, y);
      expect(overlayErrorAt(a, { xMm: x, yMm: y }).magnitudeNm, `${x},${y}`).toBeCloseTo(2 * r, 12);
    }
  });

  it('counts 1 µrad over 1 mm as 1 nm', () => {
    const e = overlayErrorAt(align({ rotationUrad: 1 }), { xMm: 1, yMm: 0 });
    expect(e.eyNm).toBe(1);
    expect(e.exNm === 0 || Object.is(e.exNm, -0)).toBe(true);
    expect(overlayErrorAt(align({ rotationUrad: 1 }), { xMm: R, yMm: 0 }).magnitudeNm).toBe(R);
  });

  it('turns counter-clockwise for a positive angle: (x, y) moves along (−y, x)', () => {
    const e = overlayErrorAt(align({ rotationUrad: 3 }), { xMm: 10, yMm: 20 });
    expect(e.exNm).toBe(-60);
    expect(e.eyNm).toBe(30);
  });

  it('adds up: the error of a combined misplacement is the sum of its parts', () => {
    const site = { xMm: 70, yMm: -45 };
    const shift = overlayErrorAt(align({ dxNm: 12, dyNm: -7 }), site);
    const turn = overlayErrorAt(align({ rotationUrad: 0.8 }), site);
    const both = overlayErrorAt(align({ dxNm: 12, dyNm: -7, rotationUrad: 0.8 }), site);
    expect(both.exNm).toBeCloseTo(shift.exNm + turn.exNm, 12);
    expect(both.eyNm).toBeCloseTo(shift.eyNm + turn.eyNm, 12);
  });

  it.each([
    [{ dxNm: Number.NaN }, { xMm: 0, yMm: 0 }],
    [{ rotationUrad: Number.POSITIVE_INFINITY }, { xMm: 0, yMm: 0 }],
    [{}, { xMm: Number.NaN, yMm: 0 }],
    [{}, { xMm: 0, yMm: Number.POSITIVE_INFINITY }],
  ])('rejects non-finite input %o at %o', (over, site) => {
    expect(() => overlayErrorAt(align(over), site)).toThrow(RangeError);
  });
});

describe('measurementSites', () => {
  it('are the wafer centre and four points on the rim, centre first', () => {
    const sites = measurementSites();
    expect(sites).toHaveLength(5);
    expect(sites[0]).toEqual({ xMm: 0, yMm: 0 });
    for (const s of sites.slice(1)) expect(Math.hypot(s.xMm, s.yMm)).toBe(R);
    const keys = sites.slice(1).map((s) => `${s.xMm},${s.yMm}`);
    expect(new Set(keys).size).toBe(4);
  });

  it('takes the rim radius as an argument', () => {
    for (const s of measurementSites(40).slice(1)) expect(Math.hypot(s.xMm, s.yMm)).toBe(40);
  });

  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])('rejects radius %s', (radius) => {
    expect(() => measurementSites(radius)).toThrow(RangeError);
  });
});

describe('worstOverlayNm', () => {
  it('is zero for a perfectly placed mask', () => {
    expect(worstOverlayNm(zero)).toBe(0);
  });

  it('equals the centre error when the mask is only shifted', () => {
    const a = align({ dxNm: 24, dyNm: 7 });
    expect(worstOverlayNm(a)).toBe(25);
  });

  it('is larger at the rim than at the centre whenever the mask is rotated, whatever the shift', () => {
    for (const dxNm of [-60, 0, 25]) {
      for (const dyNm of [-30, 0, 45]) {
        for (const rotationUrad of [-1.5, -0.2, 0.2, 1.5]) {
          const a: Alignment = { dxNm, dyNm, rotationUrad };
          const centre = overlayErrorAt(a, { xMm: 0, yMm: 0 }).magnitudeNm;
          const worst = worstOverlayNm(a);
          expect(worst, JSON.stringify(a)).toBeGreaterThan(centre);
        }
      }
    }
  });

  it('is exactly the rim radius × the angle for a pure rotation', () => {
    expect(worstOverlayNm(align({ rotationUrad: 0.4 }))).toBeCloseTo(0.4 * R, 12);
    expect(worstOverlayNm(align({ rotationUrad: -0.4 }))).toBeCloseTo(0.4 * R, 12);
  });

  it('does not decrease as the rotation grows in either direction', () => {
    const shifted = { dxNm: 30, dyNm: -20 };
    for (const sign of [1, -1]) {
      let previous = worstOverlayNm(align(shifted));
      for (let step = 1; step <= 10; step++) {
        const worst = worstOverlayNm(align({ ...shifted, rotationUrad: sign * 0.5 * step }));
        expect(worst, `sign ${sign} step ${step}`).toBeGreaterThanOrEqual(previous);
        previous = worst;
      }
    }
  });

  it('is symmetric: the mirror-image misplacement has the same worst error', () => {
    const a = align({ dxNm: 18, dyNm: -9, rotationUrad: 0.7 });
    const mirrored = align({ dxNm: -18, dyNm: 9, rotationUrad: -0.7 });
    expect(worstOverlayNm(mirrored)).toBeCloseTo(worstOverlayNm(a), 12);
  });

  it('can be asked about its own sites', () => {
    const a = align({ rotationUrad: 1 });
    expect(worstOverlayNm(a, [{ xMm: 0, yMm: 0 }])).toBe(0);
    expect(
      worstOverlayNm(a, [
        { xMm: 0, yMm: 0 },
        { xMm: 20, yMm: 0 },
      ]),
    ).toBeCloseTo(20, 12);
  });

  it('rejects an empty list of sites', () => {
    expect(() => worstOverlayNm(zero, [])).toThrow(RangeError);
  });
});

describe('overlay tolerance and verdict', () => {
  const frac = constants.litho.overlay.toleranceFractionOfCd.value;
  const margin = constants.litho.overlay.marginalFactor.value;

  it('is a fixed fraction of the printed CD, so a smaller feature is stricter', () => {
    expect(overlayToleranceNm(1000)).toBeCloseTo(1000 * frac, 12);
    expect(overlayToleranceNm(500)).toBeCloseTo(500 * frac, 12);
    expect(overlayToleranceNm(250)).toBeLessThan(overlayToleranceNm(500));
  });

  it('passes up to the tolerance, is marginal up to marginalFactor× it, fails beyond', () => {
    const cd = 400;
    const tol = overlayToleranceNm(cd);
    expect(overlayVerdict(0, cd)).toBe('ok');
    expect(overlayVerdict(tol, cd)).toBe('ok');
    expect(overlayVerdict(tol * 1.001, cd)).toBe('marginal');
    expect(overlayVerdict(tol * margin, cd)).toBe('marginal');
    expect(overlayVerdict(tol * margin * 1.001, cd)).toBe('fail');
  });

  it.each([
    [-1, 400],
    [Number.NaN, 400],
    [10, 0],
    [10, -5],
    [10, Number.NaN],
  ])('rejects overlay %s with CD %s', (worst, cd) => {
    expect(() => overlayVerdict(worst, cd)).toThrow(RangeError);
  });

  it('rejects a CD that is not positive', () => {
    expect(() => overlayToleranceNm(0)).toThrow(RangeError);
    expect(() => overlayToleranceNm(Number.NaN)).toThrow(RangeError);
  });
});

describe('contactLanding (does the printed window still fall on the region below it?)', () => {
  // The region below is the window plus `marginNm` on each side.
  const W = 400;
  const m = 100;

  it('covers the whole window while the shift stays within the margin, on either side', () => {
    for (const offsetNm of [0, 40, 100, -100, -40]) {
      const l = contactLanding({ windowNm: W, offsetNm, marginNm: m });
      expect(l.coveredNm, `${offsetNm}`).toBe(W);
      expect(l.coverage, `${offsetNm}`).toBe(1);
      expect(l.landed, `${offsetNm}`).toBe(true);
    }
  });

  it('loses one nm of contact for every nm of shift past the margin, and none is left once it has slid off', () => {
    expect(contactLanding({ windowNm: W, offsetNm: 200, marginNm: m }).coveredNm).toBeCloseTo(
      300,
      12,
    );
    expect(contactLanding({ windowNm: W, offsetNm: 300, marginNm: m }).coveredNm).toBeCloseTo(
      200,
      12,
    );
    expect(contactLanding({ windowNm: W, offsetNm: -300, marginNm: m }).coveredNm).toBeCloseTo(
      200,
      12,
    );
    expect(contactLanding({ windowNm: W, offsetNm: 500, marginNm: m }).coveredNm).toBe(0);
    expect(contactLanding({ windowNm: W, offsetNm: 900, marginNm: m }).coveredNm).toBe(0);
    const partial = contactLanding({ windowNm: W, offsetNm: 300, marginNm: m });
    expect(partial.coverage).toBeCloseTo(0.5, 12);
    expect(partial.landed).toBe(false);
  });

  it('never gains contact as the shift grows', () => {
    let previous = Infinity;
    for (let offsetNm = 0; offsetNm <= 700; offsetNm += 20) {
      const { coveredNm } = contactLanding({ windowNm: W, offsetNm, marginNm: m });
      expect(coveredNm, `${offsetNm}`).toBeLessThanOrEqual(previous);
      previous = coveredNm;
    }
  });

  it('with no margin, any shift at all costs contact', () => {
    expect(contactLanding({ windowNm: W, offsetNm: 0, marginNm: 0 }).landed).toBe(true);
    expect(contactLanding({ windowNm: W, offsetNm: 1, marginNm: 0 }).landed).toBe(false);
  });

  it('lands exactly when the shift is within the overlay tolerance, if that tolerance is the margin', () => {
    const cdNm = 600;
    const tol = overlayToleranceNm(cdNm);
    for (const offsetNm of [0, 0.5 * tol, tol, -tol]) {
      expect(contactLanding({ windowNm: cdNm, offsetNm, marginNm: tol }).landed).toBe(true);
    }
    for (const offsetNm of [1.01 * tol, -1.5 * tol, 3 * tol]) {
      expect(contactLanding({ windowNm: cdNm, offsetNm, marginNm: tol }).landed).toBe(false);
    }
  });

  it.each([
    { windowNm: 0, offsetNm: 0, marginNm: 10 },
    { windowNm: -5, offsetNm: 0, marginNm: 10 },
    { windowNm: 400, offsetNm: Number.NaN, marginNm: 10 },
    { windowNm: 400, offsetNm: 0, marginNm: -1 },
    { windowNm: 400, offsetNm: 0, marginNm: Number.NaN },
    { windowNm: Number.POSITIVE_INFINITY, offsetNm: 0, marginNm: 10 },
  ])('rejects %o', (args) => {
    expect(() => contactLanding(args)).toThrow(RangeError);
  });
});
