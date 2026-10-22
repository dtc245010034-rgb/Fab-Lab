/**
 * The sentences that say why a print is not Đạt (reasons.ts) and what to watch in one that is
 * (cautions.ts). Every sentence is checked against the model it speaks about: a claim in the copy
 * ("giảm liều thì màng mỏng đi") is a test here, not a hope.
 */
import { describe, expect, it } from 'vitest';
import { CAUTION_CODES, cautions } from '../../src/content/vi/m03/cautions';
import { causeLabels, passReason, reasons } from '../../src/content/vi/m03/reasons';
import { constants, type LightSourceId } from '../../src/physics/constants';
import { exposeResist, type ExposureInput } from '../../src/physics/exposure';
import { DEFAULT_M03_RECIPE } from '../../src/sim/defaults';
import {
  createSession,
  deriveView,
  goToStep,
  setRecipe,
  type Cause,
  type CauseCode,
} from '../../src/sim/m03';
import { fixedVi, nmVi } from '../../src/ui/numbers';

/** `Record<CauseCode, true>`: TypeScript refuses this list the day a code is added without a line here. */
const ALL_CODES: Record<CauseCode, true> = {
  'below-resolution': true,
  underbaked: true,
  bridging: true,
  underdose: true,
  overdose: true,
  scum: true,
  'near-resolution': true,
  'out-of-focus': true,
  overbaked: true,
  underdeveloped: true,
  overdeveloped: true,
  'cd-off-size': true,
  overlay: true,
};
const CODES = Object.keys(ALL_CODES) as CauseCode[];

const SOURCES: LightSourceId[] = ['g', 'i', 'krf', 'arf'];

/** The view at a step (the last one, where the overlay counts, unless told otherwise). */
const viewOf = (patch: Partial<ExposureInput>, step = 6) =>
  deriveView(goToStep(setRecipe(createSession(1), patch), step));

/** Every cause the judge gives over a spread of recipes, with the recipe that gave it. */
function sweep() {
  const found: { cause: Cause; recipe: Partial<ExposureInput> }[] = [];
  for (const polarity of ['positive', 'negative'] as const) {
    for (const source of SOURCES) {
      const cd = exposeResist({ ...DEFAULT_M03_RECIPE, source, polarity }).cdMinNm;
      for (const designNm of [0.5, 0.8, 1.05, 1.3, 1.6, 3].map((k) => Math.round(k * cd))) {
        for (const dose of [0.7, 0.85, 1, 1.15, 1.3]) {
          for (const defocusNm of [0, 400]) {
            for (const developMin of [0.5, 1, 2]) {
              for (const softBake of [
                { tempC: 90, timeMin: 1 },
                { tempC: 60, timeMin: 1 },
                { tempC: 120, timeMin: 3 },
              ]) {
                const recipe = {
                  source,
                  polarity,
                  designNm,
                  dose,
                  defocusNm,
                  developMin,
                  softBake,
                };
                for (const cause of viewOf(recipe).verdict.causes) found.push({ cause, recipe });
              }
            }
          }
        }
      }
    }
  }
  return found;
}

const SWEPT = sweep();

describe('reasons: one sentence for every cause the judge can give', () => {
  it('the sweep reaches most codes, so the check below is not empty', () => {
    const seen = new Set(SWEPT.map((s) => s.cause.code));
    expect(seen.size).toBeGreaterThanOrEqual(9);
    for (const code of ['scum', 'cd-off-size', 'underbaked', 'overdeveloped'] as const) {
      expect(seen.has(code), code).toBe(true);
    }
  });

  it('writes a plain sentence for each cause the sweep found, with no placeholder left in it', () => {
    for (const { cause } of SWEPT) {
      const text = reasons[cause.code](cause);
      expect(text.length, cause.code).toBeGreaterThan(20);
      expect(text, cause.code).not.toMatch(/undefined|NaN|Infinity|\[object|\{|\}/);
      expect(text.endsWith('.'), `${cause.code}: ends with a full stop`).toBe(true);
    }
  });

  it.each(CODES)(
    '%s: answers a cause that carries no number at all, without a hole in the text',
    (code) => {
      const text = reasons[code]({ code, severity: 'marginal' });
      expect(text).not.toMatch(/undefined|NaN|Infinity/);
      expect(text.length).toBeGreaterThan(20);
    },
  );

  it('gives each cause a short label of its own', () => {
    const labels = CODES.map((c) => causeLabels[c]);
    expect(new Set(labels).size).toBe(CODES.length);
    for (const label of labels) {
      expect(label.length).toBeGreaterThan(3);
      expect(label.length).toBeLessThanOrEqual(24);
    }
  });

  it('never calls σ a PSF, and never claims a hard resolution limit (copy rules of the M03 spec)', () => {
    for (const code of CODES) {
      const text = reasons[code]({
        code,
        severity: 'fail',
        valueNm: 12,
        fraction: -0.2,
        doseAdvice: 'increase',
      });
      expect(text).not.toMatch(/PSF/);
      expect(text).not.toMatch(/giới hạn phân giải/i);
    }
  });
});

describe('reasons: the sizes are the ones of the cause', () => {
  it('scum, bridging and overlay write their size in nm, with a decimal comma where there is one', () => {
    for (const code of ['scum', 'bridging', 'overlay'] as const) {
      const text = reasons[code]({ code, severity: 'fail', valueNm: 123.4 });
      expect(text, code).toContain(nmVi(123.4));
    }
  });

  it('cd-off-size says narrower or wider, by how much in nm and in percent, and the tolerance', () => {
    const tol = constants.litho.exposure.cdToleranceFraction.value * 100;
    const narrow = reasons['cd-off-size']({
      code: 'cd-off-size',
      severity: 'marginal',
      valueNm: -71.5,
      fraction: -0.151,
      doseAdvice: 'increase',
    });
    expect(narrow).toMatch(/hẹp hơn/);
    expect(narrow).toContain(nmVi(71.5));
    expect(narrow).toContain(`${fixedVi(15.1, 1)}%`);
    expect(narrow).toContain(`${fixedVi(tol, 0)}%`);
    const wide = reasons['cd-off-size']({
      code: 'cd-off-size',
      severity: 'marginal',
      valueNm: 60,
      fraction: 0.12,
      doseAdvice: 'decrease',
    });
    expect(wide).toMatch(/rộng hơn/);
    expect(wide).not.toMatch(/hẹp hơn/);
  });

  it('cd-off-size turns the dose the way doseAdvice says, for either resist, and never from its own guess', () => {
    const cases = SWEPT.filter((s) => s.cause.code === 'cd-off-size');
    for (const polarity of ['positive', 'negative'] as const) {
      const ofPolarity = cases.filter((s) => s.recipe.polarity === polarity);
      const advices = new Set(ofPolarity.map((s) => s.cause.doseAdvice));
      expect(advices, `${polarity}: both directions occur in the sweep`).toEqual(
        new Set(['increase', 'decrease']),
      );
    }
    for (const { cause } of cases) {
      const text = reasons['cd-off-size'](cause);
      if (cause.doseAdvice === 'increase') {
        expect(text).toMatch(/tăng liều/);
        expect(text).not.toMatch(/giảm liều/);
      } else {
        expect(text).toMatch(/giảm liều/);
        expect(text).not.toMatch(/tăng liều/);
      }
    }
  });

  it('cd-off-size gives no advice when the cause carries none (the sentence does not guess)', () => {
    const text = reasons['cd-off-size']({
      code: 'cd-off-size',
      severity: 'marginal',
      valueNm: -50,
      fraction: -0.1,
    });
    expect(text).not.toMatch(/tăng liều|giảm liều/);
  });
});

describe('reasons: what the sentence tells the learner to do works in the model', () => {
  it('bridging: less dose, or a wider design, thins the skin (the sentence says both)', () => {
    const base = SWEPT.find(
      (s) => s.cause.code === 'bridging' && (s.cause.valueNm ?? 0) > 20 && s.recipe.dose! > 0.7,
    )!;
    expect(base, 'a bridged window in the sweep').toBeDefined();
    const text = reasons.bridging(base.cause);
    expect(text).toMatch(/giảm liều/);
    expect(text).toMatch(/tăng độ rộng thiết kế/);
    const input = { ...DEFAULT_M03_RECIPE, ...base.recipe } as ExposureInput;
    const skin = exposeResist(input).skinNm;
    expect(exposeResist({ ...input, dose: input.dose * 0.9 }).skinNm).toBeLessThan(skin);
    expect(exposeResist({ ...input, designNm: input.designNm * 1.5 }).skinNm).toBeLessThan(skin);
  });

  it('below-resolution: a wider design opens a window where the same setting opened none', () => {
    const base = SWEPT.find((s) => s.cause.code === 'below-resolution')!;
    expect(base, 'a window that does not open, in the sweep').toBeDefined();
    expect(reasons['below-resolution'](base.cause)).toMatch(/tăng độ rộng thiết kế/);
    const input = { ...DEFAULT_M03_RECIPE, ...base.recipe } as ExposureInput;
    expect(exposeResist(input).openAtTop).toBe(false);
    expect(exposeResist({ ...input, designNm: input.designNm * 4 }).openAtTop).toBe(true);
  });
});

describe('passReason: why a print that is Đạt is Đạt', () => {
  const pass = (patch: Partial<ExposureInput> = {}) => {
    const view = viewOf(patch, 5); // 3.6, where the verdict is shown and the overlay is not yet counted
    expect(view.verdict.grade).toBe('ok');
    return passReason(view.exposure);
  };

  it('gives the width at the foot and the design, and how far apart they are', () => {
    const e = exposeResist(DEFAULT_M03_RECIPE);
    const text = pass();
    expect(text).toContain(nmVi(e.printedNm));
    expect(text).toContain(nmVi(e.designNm));
    expect(text).toContain(`${fixedVi(Math.abs(e.cdErrorFraction) * 100, 1)}%`);
  });

  it('names the tolerances from the constants, not from memory', () => {
    const text = pass();
    expect(text).toContain(
      `${fixedVi(constants.litho.exposure.cdToleranceFraction.value * 100, 0)}%`,
    );
    expect(text).toContain(`${fixedVi(constants.litho.exposure.scumOkFraction.value * 100, 0)}%`);
  });

  it('is a plain sentence', () => {
    const text = pass();
    expect(text).not.toMatch(/undefined|NaN|Infinity/);
    expect(text.endsWith('.')).toBe(true);
  });
});

describe('cautions: a print that is right, and what to watch in how it was made', () => {
  const rightPrint = (patch: Partial<ExposureInput>) => {
    const e = exposeResist({ ...DEFAULT_M03_RECIPE, ...patch });
    expect(e.cleanToFoot).toBe(true);
    return e;
  };

  it('has a sentence for the four process flags and no other', () => {
    expect([...CAUTION_CODES].sort()).toEqual(
      ['out-of-focus', 'overbaked', 'overdeveloped', 'underdeveloped'].sort(),
    );
    for (const code of CAUTION_CODES) expect(typeof cautions[code]).toBe('function');
  });

  it('out-of-focus: gives the offset and the depth of focus, in nm', () => {
    const e = rightPrint({ defocusNm: 300 });
    expect(e.flags).toContain('out-of-focus');
    const text = cautions['out-of-focus'](e);
    expect(text).toMatch(/^Bản in vẫn đúng, nhưng/);
    expect(text).toContain(nmVi(300));
    expect(text).toContain(nmVi(e.dofNm));
  });

  it('overbaked: gives the bake at the reference temperature and the dose that is left', () => {
    const e = rightPrint({ softBake: { tempC: 100, timeMin: 3 }, dose: 1.3 });
    expect(e.flags).toContain('overbaked');
    const text = cautions.overbaked(e);
    expect(text).toMatch(/^Bản in vẫn đúng, nhưng/);
    expect(text).toContain(`${fixedVi(e.bakeEquivalentMin, 1)} phút`);
    expect(text).toContain(`${constants.litho.bake.refTempC.value} °C`);
    expect(text).toContain(`×${fixedVi(e.effectiveDose, 2)}`);
  });

  it('underdeveloped: says a shorter develop leaves scum, and that is true of the model', () => {
    const input = { ...DEFAULT_M03_RECIPE, developMin: 0.995 };
    const e = exposeResist(input);
    expect(e.flags).toContain('underdeveloped');
    expect(e.cleanToFoot).toBe(true);
    const text = cautions.underdeveloped(e);
    expect(text).toMatch(/^Bản in vẫn đúng, nhưng/);
    expect(text).toMatch(/cặn/);
    expect(text).toContain(`${fixedVi(0.995, 2)} phút`);
    expect(exposeResist({ ...input, developMin: 0.9 }).cleanToFoot).toBe(false);
  });

  it('overdeveloped: gives the thickness that is left, and the film it was thinned from', () => {
    const e = rightPrint({ developMin: 2 });
    expect(e.flags).toContain('overdeveloped');
    const text = cautions.overdeveloped(e);
    expect(text).toMatch(/^Bản in vẫn đúng, nhưng/);
    expect(text).toContain(nmVi(e.resistThicknessNm));
    expect(e.resistThicknessNm).toBeLessThan(exposeResist(DEFAULT_M03_RECIPE).resistThicknessNm);
  });
});
