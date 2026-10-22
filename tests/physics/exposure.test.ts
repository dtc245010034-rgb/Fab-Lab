import { describe, expect, it } from 'vitest';
import { dofNm } from '../../src/physics/aerial';
import { constants, type LightSourceId } from '../../src/physics/constants';
import {
  bakeEquivalentMin,
  exposeResist,
  modelCdMinNm,
  type ExposureInput,
} from '../../src/physics/exposure';
import { minFeatureNm, printLitho, resistThicknessNm } from '../../src/physics/litho';

const SOURCES: LightSourceId[] = ['g', 'i', 'krf', 'arf'];

/** The standard condition: i-line, 800 nm window, 3000 rpm, dose ×1, best focus, nominal bake and develop. */
const base: ExposureInput = {
  spinRpm: 3000,
  source: 'i',
  designNm: 800,
  dose: 1,
  defocusNm: 0,
  polarity: 'positive',
  softBake: { tempC: 90, timeMin: 1 },
  developMin: 1,
};
const run = (over: Partial<ExposureInput> = {}) => exposeResist({ ...base, ...over });

/** A design width expressed as a multiple of the textbook limit k₁·λ/NA of the source. */
const designAt = (source: LightSourceId, ratio: number) => ratio * minFeatureNm(source);

const range = (from: number, to: number, step: number) => {
  const out: number[] = [];
  for (let v = from; v <= to + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
};

// ---------------------------------------------------------------------------------------------
// The prototype thresholds, reproduced at dose ×1 only. The single-slit model has no fixed
// resolution limit: where a window starts to open depends on the dose (see the next describe).
// ---------------------------------------------------------------------------------------------
describe('prototype thresholds at dose ×1, best focus, reference resist thickness (positive resist)', () => {
  // The prototype opens nothing below 0.7·CD_min and prints clean from 1.0·CD_min. The model gets
  // those from one blur and one absorption coefficient; the tolerance on the ratio is ±0.03.
  it.each(SOURCES)('opens nothing at 0.68·CD_min (source %s)', (source) => {
    const r = run({ source, designNm: designAt(source, 0.68) });
    expect(r.openAtTop).toBe(false);
    expect(r.cleanToFoot).toBe(false);
    expect(r.printedNm).toBe(0);
    expect(r.scumNm).toBe(r.resistThicknessNm);
    expect(r.status).toBe('fail');
    expect(r.flags).toContain('below-resolution');
  });

  it.each(SOURCES)('opens a narrow window with scum at 0.72·CD_min (source %s)', (source) => {
    const r = run({ source, designNm: designAt(source, 0.72) });
    expect(r.openAtTop).toBe(true);
    expect(r.cleanToFoot).toBe(false);
    expect(r.scumNm).toBeGreaterThan(0.5 * r.resistThicknessNm);
    expect(r.status).toBe('marginal');
    expect(r.flags).toContain('near-resolution');
    expect(r.flags).not.toContain('below-resolution');
  });

  it.each(SOURCES)('is still marginal, with less scum, at 0.97·CD_min (source %s)', (source) => {
    const r = run({ source, designNm: designAt(source, 0.97) });
    const lower = run({ source, designNm: designAt(source, 0.8) });
    expect(r.status).toBe('marginal');
    expect(r.flags).toContain('near-resolution');
    expect(r.scumNm).toBeGreaterThan(0);
    expect(r.scumNm).toBeLessThan(lower.scumNm);
  });

  it.each(SOURCES)('prints clean from 1.03·CD_min (source %s)', (source) => {
    const r = run({ source, designNm: designAt(source, 1.03) });
    expect(r.scumNm).toBeLessThanOrEqual(0.01 * r.resistThicknessNm);
    expect(r.status).toBe('ok');
    expect(r.flags).toEqual([]);
  });

  it('is the same ratio for every source: only the ratio design/(λ/NA) matters', () => {
    const scum = SOURCES.map((s) => run({ source: s, designNm: designAt(s, 0.85) }).scumNm);
    for (const v of scum) expect(v).toBeCloseTo(scum[0]!, 6);
  });

  it('reports the model resolution limit within 0.5% of k₁·λ/NA at the reference thickness', () => {
    for (const source of SOURCES) {
      const model = modelCdMinNm(source, 3000, 'positive');
      const book = minFeatureNm(source);
      expect(Math.abs(model - book) / book, source).toBeLessThan(0.005);
    }
  });

  it.each(['positive', 'negative'] as const)(
    'puts the %s resist limit exactly at the edge of "clean": just above it is clean, just below it is not',
    (polarity) => {
      const tolerance = constants.litho.exposure.scumOkFraction.value;
      for (const source of SOURCES) {
        for (const spinRpm of [2000, 3000, 5000]) {
          const cdMin = modelCdMinNm(source, spinRpm, polarity);
          const above = run({ source, spinRpm, polarity, designNm: 1.001 * cdMin });
          const below = run({ source, spinRpm, polarity, designNm: 0.999 * cdMin });
          const tag = `${source} ${spinRpm} rpm`;
          expect(above.blockedFraction, tag).toBeLessThanOrEqual(tolerance);
          expect(below.blockedFraction, tag).toBeGreaterThan(tolerance);
        }
      }
    },
  );

  it('puts that limit in the result: cdMinNm and ratio = design / cdMinNm', () => {
    const r = run({ designNm: 500 });
    expect(r.cdMinNm).toBe(modelCdMinNm('i', 3000, 'positive'));
    expect(r.ratio).toBeCloseTo(500 / r.cdMinNm, 12);
  });
});

describe('the resolution limit depends on dose (single-slit model: no hard limit)', () => {
  // Fixed dose range for the "below the limit" tests, as agreed for S1.1.
  const DOSES = [0.8, 0.9, 1.0, 1.1, 1.2];

  it('opens nothing at 0.55·CD_min for any dose in ×0.8 … ×1.2', () => {
    for (const dose of DOSES) {
      const r = run({ designNm: designAt('i', 0.55), dose });
      expect(r.openAtTop, `dose ${dose}`).toBe(false);
      expect(r.status, `dose ${dose}`).toBe('fail');
    }
  });

  it('opens something at 0.95·CD_min for every dose in ×0.8 … ×1.2', () => {
    for (const dose of DOSES) {
      const r = run({ designNm: designAt('i', 0.95), dose });
      expect(r.openAtTop, `dose ${dose}`).toBe(true);
      // printedNm is the width at the foot, which scum can still block; the opening exists at the top.
      expect(r.cdTopNm, `dose ${dose}`).toBeGreaterThan(0);
    }
  });

  it('lets a higher dose open a smaller window: the limit moves with dose', () => {
    const design = designAt('i', 0.6);
    expect(run({ designNm: design, dose: 1.0 }).openAtTop).toBe(false);
    expect(run({ designNm: design, dose: 1.5 }).openAtTop).toBe(true);
  });

  it('has no hard limit: a window at 0.3·CD_min opens if the dose is big enough', () => {
    const design = designAt('i', 0.3);
    expect(run({ designNm: design, dose: 1 }).openAtTop).toBe(false);
    expect(run({ designNm: design, dose: 3 }).openAtTop).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
// Qualitative laws of M03 (docs/modules/m03-lithography.md, "Tiêu chí xong")
// ---------------------------------------------------------------------------------------------
describe('printed width versus dose', () => {
  it('grows with dose for a positive resist', () => {
    const printed = range(0.7, 1.6, 0.1).map((dose) => run({ dose }).printedNm);
    for (let i = 1; i < printed.length; i++) expect(printed[i]!).toBeGreaterThan(printed[i - 1]!);
  });

  it('shrinks with dose for a negative resist (exposed resist stays, so more light closes the window)', () => {
    const printed = range(0.7, 1.6, 0.1).map(
      (dose) => run({ dose, polarity: 'negative' }).printedNm,
    );
    for (let i = 1; i < printed.length; i++) expect(printed[i]!).toBeLessThan(printed[i - 1]!);
  });

  it('leaves less scum the higher the dose, and none from the clean dose on', () => {
    const scum = range(0.3, 1.2, 0.1).map((dose) => run({ dose }).scumNm);
    for (let i = 1; i < scum.length; i++) expect(scum[i]!).toBeLessThanOrEqual(scum[i - 1]!);
    expect(run({ dose: 0.3 }).scumNm).toBeGreaterThan(0);
    expect(run({ dose: 1 }).scumNm).toBe(0);
  });
});

describe('printed width versus focus', () => {
  // A narrow window at dose ×1 (0.5 of the peak is where the bottom edge sits): defocus can only
  // lower the intensity inside the window, so the window narrows on either side of best focus.
  const narrow = designAt('i', 1.2);
  const printedAt = (defocusNm: number) => run({ designNm: narrow, defocusNm }).printedNm;

  // Strictly narrower at every step while there is a width to lose; once the foot of the window
  // has closed (width 0, with scum above it) it stays closed.
  const expectNarrowing = (p: number[]) => {
    expect(p[0]!).toBeGreaterThan(0);
    for (let i = 1; i < p.length; i++) {
      if (p[i - 1]! > 0) expect(p[i]!, `step ${i}`).toBeLessThan(p[i - 1]!);
      else expect(p[i]!, `step ${i}`).toBe(0);
    }
    expect(p[p.length - 1]!).toBe(0);
  };

  it('narrows as |Δz| grows, on the positive side, until it closes', () => {
    expectNarrowing(range(0, 500, 25).map(printedAt));
  });

  it('narrows as |Δz| grows, on the negative side, until it closes', () => {
    expectNarrowing(range(0, 500, 25).map((dz) => printedAt(-dz)));
  });

  it('is exactly symmetric about best focus in every number it reports', () => {
    for (const dz of [30, 120, 260, 500, 1200]) {
      const plus = run({ designNm: narrow, defocusNm: dz });
      const minus = run({ designNm: narrow, defocusNm: -dz });
      // Only the echoed input differs (+dz against −dz); everything the model computed must match.
      expect({ ...minus, defocusNm: 0 }, `±${dz}`).toEqual({ ...plus, defocusNm: 0 });
    }
  });

  it('closes the window altogether when far out of focus', () => {
    for (const dz of [1500, -1500]) {
      const r = run({ designNm: narrow, defocusNm: dz });
      expect(r.openAtTop).toBe(false);
      expect(r.cleanToFoot).toBe(false);
      expect(r.printedNm).toBe(0);
      expect(r.status).toBe('fail');
    }
  });

  it('reports the blur and the depth of focus it used', () => {
    const r = run({ defocusNm: 100 });
    expect(r.dofNm).toBeCloseTo(dofNm('i'), 9);
    expect(r.sigmaNm).toBeGreaterThan(run({ defocusNm: 0 }).sigmaNm);
  });

  it('flags "out-of-focus" beyond ±DOF/2, and only there', () => {
    const half = dofNm('i') / 2;
    expect(run({ defocusNm: 0.98 * half }).flags).not.toContain('out-of-focus');
    expect(run({ defocusNm: -0.98 * half }).flags).not.toContain('out-of-focus');
    for (const dz of [1.02 * half, -1.02 * half]) {
      const r = run({ defocusNm: dz });
      expect(r.flags).toContain('out-of-focus');
      expect(r.status).not.toBe('ok');
    }
  });
});

describe('resist profile', () => {
  it('flares a positive resist wall: the window is wider at the top than at the foot', () => {
    const r = run();
    expect(r.taperNm).toBeGreaterThan(0);
    expect(r.cdTopNm).toBeGreaterThan(r.printedNm);
    expect(r.wallAngleDeg).toBeLessThan(90);
    expect(r.wallAngleDeg).toBeGreaterThan(60);
  });

  it('undercuts a negative resist wall: the window is narrower at the top than at the foot', () => {
    const r = run({ polarity: 'negative' });
    expect(r.taperNm).toBeLessThan(0);
    expect(r.cdTopNm).toBeLessThan(r.printedNm);
    expect(r.wallAngleDeg).toBeGreaterThan(90);
  });

  it('ties the taper to the widths: top half-width − foot half-width, with no erosion', () => {
    const r = run();
    expect(r.taperNm).toBeCloseTo((r.cdTopNm - r.printedNm) / 2, 8);
  });

  it('prints a well-resolved window at design size at the foot (dose ×1), within 1%', () => {
    expect(Math.abs(run().printedNm - 800) / 800).toBeLessThan(0.01);
  });

  it('keeps the resist as thick as the spin coat made it when nothing erodes it', () => {
    expect(run().resistThicknessNm).toBe(resistThicknessNm(3000));
  });
});

describe('resist thickness', () => {
  it('raises the resolution limit for a thicker film and lowers it for a thinner one', () => {
    const thin = modelCdMinNm('i', 6000, 'positive');
    const ref = modelCdMinNm('i', 3000, 'positive');
    const thick = modelCdMinNm('i', 1500, 'positive');
    expect(thin).toBeLessThan(ref);
    expect(ref).toBeLessThan(thick);
  });

  it('leaves more scum on a thicker film at the same dose and design', () => {
    const design = designAt('i', 0.9);
    const scumRatio = (rpm: number) => {
      const r = run({ spinRpm: rpm, designNm: design });
      return r.scumNm / r.resistThicknessNm;
    };
    expect(scumRatio(1500)).toBeGreaterThan(scumRatio(3000));
    expect(scumRatio(3000)).toBeGreaterThan(scumRatio(6000));
  });
});

describe('positive and negative resist', () => {
  it('both print a well-resolved window, and both print it at about the design size', () => {
    const pos = run();
    const neg = run({ polarity: 'negative' });
    for (const r of [pos, neg]) {
      expect(r.status).toBe('ok');
      expect(Math.abs(r.printedNm - 800) / 800).toBeLessThan(0.02);
    }
  });

  it('bridges over a narrow window with a skin at the top, not scum at the foot', () => {
    const r = run({ polarity: 'negative', designNm: designAt('i', 1.2) });
    expect(r.skinNm).toBeGreaterThan(0);
    expect(r.scumNm).toBe(0);
    expect(r.flags).toContain('bridging');
    // The skin covers the window at the top, so nothing is open there: a fail, not a marginal.
    expect(r.openAtTop).toBe(false);
    expect(r.cleanToFoot).toBe(false);
    expect(r.status).toBe('fail');
  });

  it('runs the wall of a bridged window from the underside of the skin down to the foot', () => {
    const r = run({ polarity: 'negative', designNm: designAt('i', 1.2) });
    expect(r.skinNm).toBeGreaterThan(0);
    // The opening starts where the skin ends (width 0 there), so its height is the film minus
    // the skin, and the wall leans out below it.
    expect(r.cdTopNm).toBeCloseTo(0, 9);
    const height = r.resistThicknessNm - r.skinNm;
    const expected = (Math.atan2(height, (r.cdTopNm - r.printedNm) / 2) * 180) / Math.PI;
    expect(r.wallAngleDeg).toBeCloseTo(expected, 9);
    expect(r.wallAngleDeg).toBeGreaterThan(90);
  });

  it('tells "open at the top" from "clean to the foot": a window that scums is the first, not the second', () => {
    // 0.8·CD_min at ×1: the centre is bright enough to clear the top part of the film only.
    const r = run({ designNm: designAt('i', 0.8) });
    expect(r.openAtTop).toBe(true);
    expect(r.cleanToFoot).toBe(false);
    expect(r.cdTopNm).toBeGreaterThan(0);
    expect(r.printedNm).toBe(0); // the foot is blocked, so the width at the foot is 0
    expect(r.status).toBe('marginal');
    const clean = run();
    expect(clean.openAtTop).toBe(true);
    expect(clean.cleanToFoot).toBe(true);
    expect(clean.printedNm).toBeGreaterThan(0);
  });

  it('is clean to the foot exactly when the residue is within tolerance, and never without being open at the top', () => {
    const tolerance = constants.litho.exposure.scumOkFraction.value;
    for (const polarity of ['positive', 'negative'] as const) {
      for (const ratio of [0.4, 0.7, 0.9, 1, 1.1, 1.4, 2, 3]) {
        for (const dose of [0.6, 1, 1.4]) {
          const r = run({ polarity, dose, designNm: designAt('i', ratio) });
          const tag = `${polarity} ${ratio} ×${dose}`;
          expect(r.cleanToFoot, tag).toBe(r.openAtTop && r.blockedFraction <= tolerance);
          if (r.cleanToFoot) expect(r.openAtTop, tag).toBe(true);
        }
      }
    }
  });

  it('covers a negative window with a skin thicker than the tolerance, and not with a thinner one', () => {
    const cdMin = modelCdMinNm('i', 3000, 'negative');
    const thin = run({ polarity: 'negative', designNm: 1.001 * cdMin });
    expect(thin.skinNm).toBeGreaterThan(0);
    expect(thin.openAtTop).toBe(true);
    expect(thin.cleanToFoot).toBe(true);
    const thick = run({ polarity: 'negative', designNm: 0.999 * cdMin });
    expect(thick.openAtTop).toBe(false);
    expect(thick.cleanToFoot).toBe(false);
    expect(thick.status).toBe('fail');
  });

  it('opens nothing for a window far below the limit', () => {
    const r = run({ polarity: 'negative', designNm: designAt('i', 0.5) });
    expect(r.openAtTop).toBe(false);
    expect(r.status).toBe('fail');
  });

  it('fails an underexposed negative resist whose foot is not cross-linked', () => {
    const r = run({ polarity: 'negative', dose: 0.3 });
    expect(r.openAtTop).toBe(false);
    expect(r.status).toBe('fail');
    expect(r.flags).toContain('underdose');
  });

  it('needs a larger window than the positive resist to print clean, in this model', () => {
    expect(modelCdMinNm('i', 3000, 'negative')).toBeGreaterThan(
      modelCdMinNm('i', 3000, 'positive'),
    );
  });
});

// ---------------------------------------------------------------------------------------------
// Staying close to the prototype model that M04 keeps using (printLitho).
// ---------------------------------------------------------------------------------------------
describe('agreement with printLitho at dose ×1, best focus, reference thickness', () => {
  // Largest accepted relative difference in the printed width at the resist foot, by how well
  // the window is resolved. The new model blurs the edge, so a window near the limit prints
  // narrower than printLitho says; these bounds are the measured gap rounded up, not a wish.
  // Measured gaps (identical for all four sources, since only design/(λ/NA) matters): −15.1% at
  // 1.3, −6.2% at 1.5, −1.7% at 1.8, −0.7% at 2.0, under 0.1% from 2.5. Each row is checked at
  // ×1, ×1.25, ×1.6 and ×2.5 of its ratio.
  const TOLERANCE: [minRatio: number, maxRelativeGap: number][] = [
    [3.0, 0.005],
    [2.0, 0.01],
    [1.8, 0.02],
    [1.5, 0.07],
    [1.3, 0.16],
  ];

  it.each(TOLERANCE)('from %d·CD_min up, the gap is at most %d', (minRatio, maxGap) => {
    for (const source of SOURCES) {
      for (const ratio of [minRatio, minRatio * 1.25, minRatio * 1.6, minRatio * 2.5]) {
        const designNm = designAt(source, ratio);
        const mine = run({ source, designNm }).printedNm;
        const proto = printLitho({ spinRpm: 3000, source, designNm, dose: 1 }).printedNm;
        expect(Math.abs(mine - proto) / proto, `${source} ${ratio}`).toBeLessThanOrEqual(maxGap);
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Soft bake and develop
// ---------------------------------------------------------------------------------------------
describe('soft bake', () => {
  it('counts equivalent minutes at the reference temperature: +10 °C doubles, time scales linearly', () => {
    expect(bakeEquivalentMin({ tempC: 90, timeMin: 1 })).toBeCloseTo(1, 12);
    expect(bakeEquivalentMin({ tempC: 100, timeMin: 1 })).toBeCloseTo(2, 12);
    expect(bakeEquivalentMin({ tempC: 80, timeMin: 1 })).toBeCloseTo(0.5, 12);
    expect(bakeEquivalentMin({ tempC: 90, timeMin: 2.5 })).toBeCloseTo(2.5, 12);
  });

  it('changes nothing between the limits: any bake of 0.5 … 3 equivalent minutes prints alike', () => {
    const nominal = run();
    for (const softBake of [
      { tempC: 90, timeMin: 0.6 },
      { tempC: 100, timeMin: 1 },
      { tempC: 90, timeMin: 2.8 },
    ]) {
      const r = run({ softBake });
      expect(r.printedNm, JSON.stringify(softBake)).toBe(nominal.printedNm);
      expect(r.scumNm, JSON.stringify(softBake)).toBe(nominal.scumNm);
      expect(r.flags, JSON.stringify(softBake)).toEqual([]);
    }
  });

  it('fails an underbaked resist, which keeps too much solvent', () => {
    for (const softBake of [
      { tempC: 60, timeMin: 1 },
      { tempC: 90, timeMin: 0.2 },
      { tempC: 90, timeMin: 0 },
    ]) {
      const r = run({ softBake });
      expect(r.flags, JSON.stringify(softBake)).toContain('underbaked');
      expect(r.status, JSON.stringify(softBake)).toBe('fail');
    }
  });

  it('makes an overbaked resist less sensitive: smaller effective dose, narrower window', () => {
    const nominal = run();
    const over = run({ softBake: { tempC: 110, timeMin: 2 } });
    expect(over.flags).toContain('overbaked');
    expect(over.effectiveDose).toBeLessThan(nominal.effectiveDose);
    expect(over.printedNm).toBeLessThan(nominal.printedNm);
  });

  it('lowers the effective dose monotonically with every minute past the limit', () => {
    const dose = range(3, 12, 1).map(
      (timeMin) => run({ softBake: { tempC: 90, timeMin } }).effectiveDose,
    );
    for (let i = 1; i < dose.length; i++) expect(dose[i]!).toBeLessThan(dose[i - 1]!);
    expect(run().effectiveDose).toBe(1);
  });
});

describe('develop', () => {
  it('clears the whole thickness in the reference time and leaves residue before it', () => {
    expect(run({ developMin: 1 }).scumNm).toBe(0);
    const scum = range(0.2, 1, 0.2).map((developMin) => run({ developMin }).scumNm);
    for (let i = 1; i < scum.length; i++) expect(scum[i]!).toBeLessThan(scum[i - 1]!);
    expect(run({ developMin: 0.5 }).flags).toContain('underdeveloped');
    expect(run({ developMin: 0.5 }).status).toBe('marginal');
  });

  it('opens nothing when it is not developed at all', () => {
    const r = run({ developMin: 0 });
    expect(r.openAtTop).toBe(false);
    expect(r.status).toBe('fail');
  });

  it('changes nothing between the reference time and 1.5× of it', () => {
    const nominal = run();
    for (const developMin of [1, 1.2, 1.5]) {
      const r = run({ developMin });
      expect(r.printedNm, `${developMin}`).toBe(nominal.printedNm);
      expect(r.resistThicknessNm, `${developMin}`).toBe(nominal.resistThicknessNm);
      expect(r.flags, `${developMin}`).toEqual([]);
    }
  });

  it('keeps the scum inside the film that is left, even when overdevelopment has thinned it', () => {
    // A window that never opens leaves the whole film as residue; after overdevelopment the film
    // is thinner, and the residue cannot be thicker than what is left.
    const r = run({ developMin: 3, designNm: designAt('i', 0.5) });
    expect(r.openAtTop).toBe(false);
    expect(r.resistThicknessNm).toBeLessThan(resistThicknessNm(3000));
    expect(r.scumNm).toBeLessThanOrEqual(r.resistThicknessNm);
    expect(r.scumNm).toBe(r.resistThicknessNm);
  });

  it('measures the flare of the wall over the film that is left, not over the film that was coated', () => {
    const nominal = run();
    const developMin = 3;
    const erosion =
      constants.litho.develop.darkErosionFractionPerMin.value *
      (developMin -
        constants.litho.develop.overdevelopAboveRel.value * constants.litho.develop.refMin.value);
    const eroded = run({ developMin });
    // Same optics, so the same straight wall; erosion takes the top off it.
    expect(eroded.taperNm).toBeCloseTo(nominal.taperNm * (1 - erosion), 9);
    expect(eroded.taperNm).toBeLessThan(nominal.taperNm);
  });

  it('thins the resist and widens the window once it is overdeveloped', () => {
    const nominal = run();
    const thickness = range(1.5, 3, 0.5).map((developMin) => run({ developMin }).resistThicknessNm);
    const width = range(1.5, 3, 0.5).map((developMin) => run({ developMin }).printedNm);
    for (let i = 1; i < thickness.length; i++) {
      expect(thickness[i]!).toBeLessThan(thickness[i - 1]!);
      expect(width[i]!).toBeGreaterThan(width[i - 1]!);
    }
    expect(run({ developMin: 3 }).resistThicknessNm).toBeLessThan(nominal.resistThicknessNm);
    expect(run({ developMin: 3 }).flags).toContain('overdeveloped');
  });
});

// ---------------------------------------------------------------------------------------------
// Flags and status
// ---------------------------------------------------------------------------------------------
describe('flags and status', () => {
  it('is "ok" with no flags for the standard condition', () => {
    const r = run();
    expect(r.status).toBe('ok');
    expect(r.flags).toEqual([]);
  });

  it('blames the dose, not the optics, for scum that a standard dose would not leave', () => {
    // 800 nm opens from dose ≈ ×0.42 (the peak of a 270 nm blur over 800 nm is ≈ 0.86) and is
    // scum-free from ≈ ×0.58; ×0.55 is in between.
    const r = run({ dose: 0.55 });
    expect(r.scumNm).toBeGreaterThan(0);
    expect(r.flags).toContain('underdose');
    expect(r.flags).not.toContain('near-resolution');
    expect(r.status).toBe('marginal');
  });

  it('flags overdose when the window grows past the size tolerance, and not before', () => {
    expect(run({ dose: 1.1 }).flags).not.toContain('overdose');
    const r = run({ dose: 1.3 });
    expect(r.flags).toContain('overdose');
    expect(r.cdErrorFraction).toBeGreaterThan(constants.litho.exposure.cdToleranceFraction.value);
    expect(r.status).toBe('marginal');
  });

  it('blames the optics when a window near the limit scums at any dose-1 condition', () => {
    const r = run({ designNm: designAt('i', 0.85) });
    expect(r.flags).toContain('near-resolution');
    expect(r.flags).not.toContain('underdose');
  });

  it('reports the fraction of the film that is blocked and the size error', () => {
    const r = run({ designNm: designAt('i', 0.85) });
    expect(r.blockedFraction).toBeCloseTo(r.scumNm / resistThicknessNm(3000), 9);
    const wide = run({ dose: 1.2 });
    expect(wide.cdErrorFraction).toBeCloseTo((wide.printedNm - 800) / 800, 12);
  });

  it('echoes the input it was given', () => {
    const r = run({ dose: 1.15, defocusNm: 40, designNm: 650 });
    expect(r).toMatchObject({
      dose: 1.15,
      defocusNm: 40,
      designNm: 650,
      source: 'i',
      spinRpm: 3000,
    });
    expect(r.softBake).toEqual({ tempC: 90, timeMin: 1 });
  });
});

describe('invariants over the whole input range', () => {
  it('never reports negative widths, scum beyond the film, or non-finite numbers', () => {
    for (const source of SOURCES) {
      for (const spinRpm of [1500, 3000, 6000]) {
        for (const polarity of ['positive', 'negative'] as const) {
          for (const designNm of [150, 300, 500, 800, 1500]) {
            for (const dose of [0.5, 0.8, 1, 1.3, 2]) {
              for (const defocusNm of [-600, -150, 0, 150, 600]) {
                const input: ExposureInput = {
                  ...base,
                  source,
                  spinRpm,
                  polarity,
                  designNm,
                  dose,
                  defocusNm,
                };
                const r = exposeResist(input);
                const tag = JSON.stringify(input);
                expect(r.printedNm, tag).toBeGreaterThanOrEqual(0);
                expect(r.scumNm, tag).toBeGreaterThanOrEqual(0);
                expect(r.scumNm, tag).toBeLessThanOrEqual(r.resistThicknessNm);
                expect(r.skinNm, tag).toBeGreaterThanOrEqual(0);
                for (const key of [
                  'printedNm',
                  'cdTopNm',
                  'taperNm',
                  'wallAngleDeg',
                  'sigmaNm',
                  'cdMinNm',
                  'effectiveDose',
                ] as const) {
                  expect(Number.isFinite(r[key]), `${tag} ${key}`).toBe(true);
                }
                expect(r.status === 'fail', tag).toBe(
                  !r.openAtTop || r.flags.includes('underbaked'),
                );
              }
            }
          }
        }
      }
    }
  });

  it('is deterministic: the same input gives the same output', () => {
    expect(run({ dose: 1.07, defocusNm: 55 })).toEqual(run({ dose: 1.07, defocusNm: 55 }));
  });

  it.each([
    { designNm: 0 },
    { designNm: -50 },
    { designNm: Number.NaN },
    { dose: 0 },
    { dose: -1 },
    { dose: Number.NaN },
    { spinRpm: 0 },
    { defocusNm: Number.NaN },
    { defocusNm: Number.POSITIVE_INFINITY },
    { developMin: -1 },
    { developMin: Number.NaN },
    { softBake: { tempC: 90, timeMin: -1 } },
    { softBake: { tempC: Number.NaN, timeMin: 1 } },
    { polarity: 'neutral' as never },
    { source: 'euv' as never },
  ])('rejects invalid input %o', (over) => {
    expect(() => run(over)).toThrow(RangeError);
  });
});
