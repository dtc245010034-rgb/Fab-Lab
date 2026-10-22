/**
 * What step 3.6 says about a print, from the view the worker sent: the word and colour of the
 * verdict, the sentence that says why, and the cautions. Only types come from sim/m03.ts (its
 * values are the lithography model, which stays in the worker); the verdict itself was worked out
 * there, and this only chooses the words.
 */
import { CAUTION_CODES, type CautionCode } from '../../content/vi/m03/cautions';
import { causeLabels, passReason, reasons } from '../../content/vi/m03/reasons';
import type { ExposureResult } from '../../physics/exposure';
import type { Grade, M03Verdict, M03View } from '../../sim/m03';
import type { Status } from '../../ui/status';

/** The verdict is Đạt / Biên / Hỏng; it is not the Đạt / Cảnh báo / Lỗi of a tile or a note. */
export const GRADE_WORDS: Readonly<Record<Grade, string>> = {
  ok: 'Đạt',
  marginal: 'Biên',
  fail: 'Hỏng',
};

/** The colour of each: the same three states the rest of the page uses. */
export const GRADE_TONES: Readonly<Record<Grade, Status>> = {
  ok: 'ok',
  marginal: 'warn',
  fail: 'bad',
};

/**
 * The process flags that are on and that the verdict does not name. A flag is a cause when the
 * print has a defect (it explains it) and a caution when the print is right (it is a risk, not a
 * fault): each flag that is on is in exactly one of the two.
 */
export function cautionsFor(
  exposure: Pick<ExposureResult, 'flags'>,
  verdict: Pick<M03Verdict, 'causes'>,
): CautionCode[] {
  const named = new Set<string>(verdict.causes.map((c) => c.code));
  return CAUTION_CODES.filter((code) => exposure.flags.includes(code) && !named.has(code));
}

/**
 * The sentence for the verdict: the first cause (failing ones first, a root before its effect), or
 * the reason a print is right; and a few words for each of the other causes.
 */
export function verdictText(view: Pick<M03View, 'exposure' | 'verdict'>): {
  why: string;
  others: string[];
} {
  const [first, ...rest] = view.verdict.causes;
  if (!first) return { why: passReason(view.exposure), others: [] };
  return { why: reasons[first.code](first), others: rest.map((c) => causeLabels[c.code]) };
}
