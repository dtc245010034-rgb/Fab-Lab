/**
 * What step 3.6 says about a print: the words of the verdict, the sentence that says why, and the
 * "Lưu ý" of the flags that explain a defect without being one. The point of the second: a flag is
 * either a cause in the verdict or a caution beside it, never both and never neither.
 */
import { describe, expect, it } from 'vitest';
import { CAUTION_CODES } from '../../src/content/vi/m03/cautions';
import { causeLabels, passReason, reasons } from '../../src/content/vi/m03/reasons';
import {
  GRADE_TONES,
  GRADE_WORDS,
  cautionsFor,
  verdictText,
} from '../../src/modules/m03-lithography/verdict';
import type { ExposureInput } from '../../src/physics/exposure';
import { createSession, deriveView, goToStep, setRecipe } from '../../src/sim/m03';

const view = (patch: Partial<ExposureInput>, step = 5) =>
  deriveView(goToStep(setRecipe(createSession(1), patch), step));

/** Recipes that put each process flag on and off, with a print that is right and one that is not. */
function recipes(): Partial<ExposureInput>[] {
  const out: Partial<ExposureInput>[] = [];
  for (const polarity of ['positive', 'negative'] as const) {
    for (const designNm of [250, 400, 600, 800, 1100]) {
      for (const dose of [0.7, 1, 1.3]) {
        for (const defocusNm of [0, 300, 700]) {
          for (const developMin of [0.5, 0.995, 1, 1.4, 2, 3]) {
            for (const softBake of [
              { tempC: 90, timeMin: 1 },
              { tempC: 60, timeMin: 1 },
              { tempC: 100, timeMin: 3 },
            ]) {
              out.push({ polarity, designNm, dose, defocusNm, developMin, softBake });
            }
          }
        }
      }
    }
  }
  return out;
}

const VIEWS = recipes().map((r) => view(r));

describe('the words of the verdict', () => {
  it('are Đạt, Biên and Hỏng, with the colours ok, warn and bad', () => {
    expect(GRADE_WORDS).toEqual({ ok: 'Đạt', marginal: 'Biên', fail: 'Hỏng' });
    expect(GRADE_TONES).toEqual({ ok: 'ok', marginal: 'warn', fail: 'bad' });
  });
});

describe('cautionsFor: the flags that explain a defect, when there is none', () => {
  it('the sweep has prints that are right, prints that are not, and every process flag', () => {
    const grades = new Set(VIEWS.map((v) => v.verdict.grade));
    expect(grades).toEqual(new Set(['ok', 'marginal', 'fail']));
    for (const code of CAUTION_CODES) {
      expect(
        VIEWS.some((v) => cautionsFor(v.exposure, v.verdict).includes(code)),
        `${code} appears as a caution`,
      ).toBe(true);
      expect(
        VIEWS.some((v) => v.verdict.causes.some((c) => c.code === code)),
        `${code} appears as a cause`,
      ).toBe(true);
    }
  });

  it('Lưu ý ∩ nguyên nhân = ∅: no flag is a caution and a cause at once', () => {
    for (const v of VIEWS) {
      const causes = v.verdict.causes.map((c) => c.code as string);
      for (const code of cautionsFor(v.exposure, v.verdict)) expect(causes).not.toContain(code);
    }
  });

  it('every process flag that is on is in exactly one of the two lists', () => {
    for (const v of VIEWS) {
      const causes = v.verdict.causes.map((c) => c.code as string);
      const cautions = cautionsFor(v.exposure, v.verdict) as string[];
      for (const code of CAUTION_CODES) {
        const on = v.exposure.flags.includes(code);
        expect(
          Number(causes.includes(code)) + Number(cautions.includes(code)),
          `${code} (flag on: ${on})`,
        ).toBe(on ? 1 : 0);
      }
    }
  });

  it('a print that is not right has none: the flags are then in the verdict', () => {
    for (const v of VIEWS.filter((x) => x.verdict.grade !== 'ok')) {
      expect(cautionsFor(v.exposure, v.verdict)).toEqual([]);
    }
  });

  it('keeps the order of the four flags, so the list does not shuffle as the sliders move', () => {
    for (const v of VIEWS) {
      const codes = cautionsFor(v.exposure, v.verdict);
      const order = codes.map((c) => CAUTION_CODES.indexOf(c));
      expect(order).toEqual([...order].sort((a, b) => a - b));
    }
  });
});

describe('verdictText: the sentence that says why, and the short list of the other causes', () => {
  it('a print that is Đạt gets the sentence of passReason, with no other cause', () => {
    const v = VIEWS.find((x) => x.verdict.grade === 'ok')!;
    expect(verdictText(v)).toEqual({ why: passReason(v.exposure), others: [] });
  });

  it('a print that is not gets the sentence of its first cause, and the labels of the rest, in order', () => {
    const many = VIEWS.filter((x) => x.verdict.causes.length >= 3);
    expect(many.length).toBeGreaterThan(0);
    for (const v of VIEWS.filter((x) => x.verdict.grade !== 'ok')) {
      const [first, ...rest] = v.verdict.causes;
      expect(verdictText(v)).toEqual({
        why: reasons[first!.code](first!),
        others: rest.map((c) => causeLabels[c.code]),
      });
    }
  });

  it('a failing cause comes first, so a Hỏng print never opens with a marginal reason', () => {
    for (const v of VIEWS.filter((x) => x.verdict.grade === 'fail')) {
      expect(v.verdict.causes[0]!.severity).toBe('fail');
    }
  });
});
