/**
 * The aerial-image graph of M03: the light across the window, and the two levels (at the top and
 * at the foot of the resist film) at which the resist dissolves. Pure physics; the graph can only
 * be trusted if it agrees with `exposeResist`, so most tests are that agreement.
 */
import { describe, expect, it } from 'vitest';
import { blurSigmaNm, dofNm, slitIntensity } from '../../src/physics/aerial';
import { constants, type LightSourceId } from '../../src/physics/constants';
import {
  aerialProfile,
  exposeResist,
  EXPOSURE_THRESHOLD,
  type ExposureInput,
  type Polarity,
} from '../../src/physics/exposure';
import { resistThicknessNm } from '../../src/physics/litho';
import { DEFAULT_M03_RECIPE } from '../../src/sim/defaults';

const ALPHA = constants.litho.exposure.absorptionPerNm.value;
const OPTIONS = { samples: 121, rangeDefocusNm: dofNm('i') };
const SOURCES: LightSourceId[] = ['g', 'i', 'krf', 'arf'];
const POLARITIES: Polarity[] = ['positive', 'negative'];

const profileOf = (patch: Partial<ExposureInput> = {}, options = OPTIONS) =>
  aerialProfile(exposeResist({ ...DEFAULT_M03_RECIPE, ...patch }), options);

describe('EXPOSURE_THRESHOLD', () => {
  it('is the one rule of exposure.ts: dose ×1 prints the design width at the foot of the 500 nm film', () => {
    expect(EXPOSURE_THRESHOLD).toBeCloseTo(0.5 * Math.exp(-ALPHA * 500), 15);
    // and so the level at the foot of that film, at dose ×1, is exactly one half
    expect(profileOf().levelFoot).toBeCloseTo(0.5, 12);
  });
});

describe('aerialProfile: axes', () => {
  it('has an odd number of samples, symmetric about a sample at x = 0', () => {
    const { xNm } = profileOf();
    expect(xNm).toHaveLength(121);
    expect(xNm[60]).toBe(0);
    for (let i = 0; i < 60; i++) expect(xNm[i]).toBeCloseTo(-xNm[120 - i]!, 9);
    for (let i = 1; i < xNm.length; i++) expect(xNm[i]!).toBeGreaterThan(xNm[i - 1]!);
  });

  it('reaches design/2 + 3σ at the largest focus offset asked for, so the axis does not move with focus', () => {
    const reach = 400 + 3 * blurSigmaNm('i', OPTIONS.rangeDefocusNm);
    const p = profileOf();
    expect(p.xNm[120]).toBeCloseTo(reach, 9);
    for (const defocusNm of [-300, 0, 150, 500]) {
      expect(profileOf({ defocusNm }).xNm).toEqual(p.xNm);
    }
  });

  it('widens with the design and with the range', () => {
    expect(profileOf({ designNm: 1200 }).xNm[120]!).toBeGreaterThan(profileOf().xNm[120]!);
    const wider = profileOf({}, { samples: 121, rangeDefocusNm: 2 * dofNm('i') });
    expect(wider.xNm[120]!).toBeGreaterThan(profileOf().xNm[120]!);
  });

  it.each([
    [{ samples: 120, rangeDefocusNm: 0 }, /odd/],
    [{ samples: 1, rangeDefocusNm: 0 }, /odd/],
    [{ samples: 121, rangeDefocusNm: -1 }, /rangeDefocusNm/],
    [{ samples: 121, rangeDefocusNm: NaN }, /rangeDefocusNm/],
  ])('refuses %j', (options, message) => {
    expect(() => profileOf({}, options)).toThrow(message);
    expect(() => profileOf({}, options)).toThrow(RangeError);
  });
});

describe('aerialProfile: the light', () => {
  it('is the blurred slit for a positive resist and the blurred dark line for a negative one', () => {
    const e = exposeResist({ ...DEFAULT_M03_RECIPE, defocusNm: 200 });
    const positive = aerialProfile(e, OPTIONS);
    const negative = aerialProfile({ ...e, polarity: 'negative' }, OPTIONS);
    positive.xNm.forEach((x, i) => {
      const slit = slitIntensity(x, e.designNm, e.sigmaNm);
      expect(positive.intensity[i]).toBeCloseTo(slit, 12);
      expect(negative.intensity[i]).toBeCloseTo(1 - slit, 12);
    });
  });

  it('stays between 0 and 1 and is even in x', () => {
    for (const polarity of POLARITIES) {
      const { intensity } = profileOf({ polarity, defocusNm: 250 });
      for (const v of intensity) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
      for (let i = 0; i < 60; i++) expect(intensity[i]).toBeCloseTo(intensity[120 - i]!, 12);
    }
  });

  it('keeps the best-focus curve for comparison: it does not move with focus and is the curve at zero offset', () => {
    const atBest = profileOf({ defocusNm: 0 });
    expect(atBest.bestFocusIntensity).toEqual(atBest.intensity);
    const off = profileOf({ defocusNm: 400 });
    expect(off.bestFocusIntensity).toEqual(atBest.bestFocusIntensity);
    expect(off.intensity).not.toEqual(atBest.intensity);
  });

  it('is blurred more by a larger focus offset of either sign: a small window gets less light in the middle', () => {
    const designNm = 400;
    const centre = (defocusNm: number) => profileOf({ designNm, defocusNm }).intensity[60]!;
    const dof = dofNm('i');
    expect(centre(dof / 2)).toBeLessThan(centre(0));
    expect(centre(dof)).toBeLessThan(centre(dof / 2));
    expect(centre(-dof)).toBeCloseTo(centre(dof), 12);
  });
});

describe('aerialProfile: the levels', () => {
  it('are the exposure threshold over the dose at the top, and e^(α·thickness) higher at the foot', () => {
    for (const dose of [0.7, 1, 1.3]) {
      const e = exposeResist({ ...DEFAULT_M03_RECIPE, dose });
      const p = aerialProfile(e, OPTIONS);
      expect(p.levelTop).toBeCloseTo(EXPOSURE_THRESHOLD / dose, 12);
      expect(p.levelFoot / p.levelTop).toBeCloseTo(Math.exp(ALPHA * resistThicknessNm(3000)), 12);
    }
  });

  it('move with the film, not only with the dose: a thicker film (slower spin) has a higher level at its foot', () => {
    const at = (spinRpm: number) => profileOf({ spinRpm }).levelFoot;
    expect(at(1500)).toBeGreaterThan(at(3000));
    expect(at(3000)).toBeGreaterThan(at(6000));
  });

  it('halve when the dose doubles, and rise when an overbake lowers the effective dose', () => {
    const base = profileOf({ dose: 0.8 });
    expect(profileOf({ dose: 1.6 }).levelTop).toBeCloseTo(base.levelTop / 2, 12);
    const overbaked = profileOf({ dose: 0.8, softBake: { tempC: 120, timeMin: 2 } });
    expect(overbaked.levelTop).toBeGreaterThan(base.levelTop);
  });
});

describe('aerialProfile agrees with exposeResist (the graph cannot contradict the numbers)', () => {
  const designs = [450, 600, 800, 1000];
  const doses = [0.8, 1, 1.2];
  const defocusInDofs = [-0.5, 0, 0.5];

  it('puts the window edges where the curve crosses the levels: foot width, and top width for a positive resist', () => {
    let checkedFoot = 0;
    let checkedTop = 0;
    for (const source of SOURCES) {
      for (const polarity of POLARITIES) {
        for (const designNm of designs) {
          for (const dose of doses) {
            for (const k of defocusInDofs) {
              const e = exposeResist({
                ...DEFAULT_M03_RECIPE,
                source,
                polarity,
                designNm: designNm * (blurSigmaNm(source, 0) / blurSigmaNm('i', 0)),
                dose,
                defocusNm: k * dofNm(source),
              });
              // no edge to compare unless the opening reaches the foot; and with a trace of scum (up to 1%)
              // the straight wall is extended past where the film was cleared, which is not a crossing
              if (!e.cleanToFoot || e.scumNm > 1e-9) continue;
              const p = aerialProfile(e, { samples: 61, rangeDefocusNm: dofNm(source) });
              const where = `${source} ${polarity} design ${e.designNm.toFixed(0)} dose ${dose} defocus ${k} DOF`;
              expect(2 * p.edgeFootNm, `foot, ${where}`).toBeCloseTo(e.printedNm, 6);
              checkedFoot++;
              if (polarity === 'positive') {
                expect(2 * p.edgeTopNm, `top, ${where}`).toBeCloseTo(e.cdTopNm, 6);
                checkedTop++;
              }
            }
          }
        }
      }
    }
    // not vacuous: most of the grid opens cleanly
    expect(checkedFoot).toBeGreaterThan(100);
    expect(checkedTop).toBeGreaterThan(50);
  });

  it('opens where the curve is above the foot level (positive) or below it (negative), and only there', () => {
    for (const polarity of POLARITIES) {
      const p = profileOf({ polarity, designNm: 900 });
      const step = p.xNm[61]! - p.xNm[60]!;
      let compared = 0;
      p.xNm.forEach((x, i) => {
        if (Math.abs(Math.abs(x) - p.edgeFootNm) < step) return; // a sample on the edge itself
        const inside = Math.abs(x) < p.edgeFootNm;
        const dissolves =
          polarity === 'positive' ? p.intensity[i]! >= p.levelFoot : p.intensity[i]! < p.levelFoot;
        expect(dissolves, `${polarity} at x = ${x.toFixed(0)} nm`).toBe(inside);
        compared++;
      });
      expect(compared).toBeGreaterThan(100);
    }
  });

  it('has the top edge wider than the foot edge for a positive resist (the flared wall) and the other way for a negative one', () => {
    const positive = profileOf({ designNm: 900 });
    expect(positive.edgeTopNm).toBeGreaterThan(positive.edgeFootNm);
    const negative = profileOf({ designNm: 900, polarity: 'negative' });
    expect(negative.edgeTopNm).toBeLessThan(negative.edgeFootNm);
  });

  it('says so when no level is reached: a positive resist with a level above the brightest point has no window, edge 0', () => {
    const p = profileOf({ designNm: 150, dose: 0.7 });
    expect(Math.max(...p.intensity)).toBeLessThan(p.levelFoot);
    expect(p.edgeFootNm).toBe(0);
  });
});
