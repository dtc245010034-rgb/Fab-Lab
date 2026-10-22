/**
 * The claims the lesson text of steps 3.1 – 3.6 makes about the model, checked against the model
 * (a sentence in a lesson is a test here, as the sentences of reasons.ts are in m03Reasons.test.ts).
 * When one of these goes red the model or the text is wrong: report it, do not bend the text to fit.
 */
import { describe, expect, it } from 'vitest';
import type { LightSourceId } from '../../src/physics/constants';
import { exposeResist, type ExposureInput } from '../../src/physics/exposure';
import { DEFAULT_M03_RECIPE, M03_CONTROLS } from '../../src/sim/defaults';

const SOURCES: LightSourceId[] = ['g', 'i', 'krf', 'arf'];
const run = (patch: Partial<ExposureInput>) => exposeResist({ ...DEFAULT_M03_RECIPE, ...patch });
const LOWEST_DOSE = M03_CONTROLS.dose.min;
const HIGHEST_DOSE = M03_CONTROLS.dose.max;

/** The widths the design slider offers. */
const { min: DESIGN_MIN, max: DESIGN_MAX, step: DESIGN_STEP } = M03_CONTROLS.designNm;
const SLIDER_DESIGNS = Array.from(
  { length: (DESIGN_MAX - DESIGN_MIN) / DESIGN_STEP + 1 },
  (_, i) => DESIGN_MIN + i * DESIGN_STEP,
);

describe('3.5, the note on scum from too little dose', () => {
  it.each(SOURCES)(
    'positive resist, %s: a design near CD_min at the lowest dose leaves scum thicker than the clean limit',
    (source) => {
      const cdMinNm = run({ source }).cdMinNm;
      const r = run({
        source,
        polarity: 'positive',
        designNm: Math.round(1.1 * cdMinNm),
        dose: LOWEST_DOSE,
      });
      expect(r.scumNm).toBeGreaterThan(0.01 * r.resistThicknessNm);
    },
  );

  it.each(SOURCES)(
    'positive resist, %s: the sliders reach it (some width on the design slider leaves scum at the lowest dose)',
    (source) => {
      const reaches = SLIDER_DESIGNS.some((designNm) => {
        const r = run({ source, polarity: 'positive', designNm, dose: LOWEST_DOSE });
        return r.scumNm > 0.01 * r.resistThicknessNm;
      });
      expect(reaches).toBe(true);
    },
  );

  it('and the default window leaves none at the lowest dose, which is why the note says to shrink it', () => {
    const r = run({ dose: LOWEST_DOSE });
    expect(r.scumNm).toBeLessThanOrEqual(0.01 * r.resistThicknessNm);
  });

  it('negative resist: too little dose widens the window and leaves no scum', () => {
    for (const source of SOURCES) {
      const nominal = run({ source, polarity: 'negative' });
      const dim = run({ source, polarity: 'negative', dose: LOWEST_DOSE });
      expect(dim.printedNm, source).toBeGreaterThan(nominal.printedNm);
      expect(dim.scumNm, source).toBe(0);
    }
  });
});

describe('3.5, the develop step', () => {
  it('a shorter develop leaves scum, a longer one thins the resist and widens the window', () => {
    const nominal = run({});
    expect(run({ developMin: 0.5 }).scumNm).toBeGreaterThan(nominal.scumNm);
    const long = run({ developMin: 3 });
    expect(long.resistThicknessNm).toBeLessThan(nominal.resistThicknessNm);
    expect(long.printedNm).toBeGreaterThan(nominal.printedNm);
  });
});

describe('3.2 and 3.4, the "Nếu làm sai:" sentences', () => {
  it('3.2: a thicker resist narrows the foot of the window at the same dose', () => {
    const designNm = 450;
    expect(run({ spinRpm: 1500, designNm }).printedNm).toBeLessThan(
      run({ spinRpm: 6000, designNm }).printedNm,
    );
  });

  it('3.4, positive resist: too little dose narrows the window, too much widens it', () => {
    const nominal = run({});
    expect(run({ dose: LOWEST_DOSE }).printedNm).toBeLessThan(nominal.printedNm);
    expect(run({ dose: HIGHEST_DOSE }).printedNm).toBeGreaterThan(nominal.printedNm);
  });

  it('3.4: a window that is small as well as dim also leaves scum', () => {
    const cdMinNm = run({}).cdMinNm;
    const r = run({ designNm: Math.round(1.1 * cdMinNm), dose: LOWEST_DOSE });
    expect(r.scumNm).toBeGreaterThan(0);
  });

  it('3.4: a defocus past the depth of focus narrows the foot, and far enough closes it', () => {
    const nominal = run({});
    const far = run({ defocusNm: 300 });
    expect(far.flags).toContain('out-of-focus');
    expect(far.printedNm).toBeLessThan(nominal.printedNm);
    expect(run({ defocusNm: 600 }).printedNm).toBe(0);
  });

  it('3.4: for the negative resist the dose goes the other way, more light narrows the window', () => {
    const nominal = run({ polarity: 'negative' });
    expect(run({ polarity: 'negative', dose: HIGHEST_DOSE }).printedNm).toBeLessThan(
      nominal.printedNm,
    );
    expect(run({ polarity: 'negative', dose: LOWEST_DOSE }).printedNm).toBeGreaterThan(
      nominal.printedNm,
    );
  });

  it('3.4: the negative resist needs a larger window than the positive one, in this model', () => {
    for (const source of SOURCES) {
      expect(run({ source, polarity: 'negative' }).cdMinNm).toBeGreaterThan(
        run({ source, polarity: 'positive' }).cdMinNm,
      );
    }
  });
});
