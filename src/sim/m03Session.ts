/**
 * M03's session, the part of it that needs no lithography model: the learner's choices and where
 * they are (steps, stages, changing the recipe, rework and commit). Plain data in, plain data out.
 * It lives apart from sim/m03.ts so that the page can use it without carrying the model, which
 * runs in the worker; sim/m03.ts re-exports all of it. Drawing the misplacement of the second mask
 * for a seed does need the model (the overlay tolerance comes from an exposure), so `createSession`
 * stays in sim/m03.ts and the page asks the worker for the first session.
 */
import type { ExposureInput } from '../physics/exposure';
import type { Alignment } from '../physics/overlay';
import type { LithoStage } from './grid';

/** Steps 3.1 … 3.7 of docs/modules/m03-lithography.md. */
export const M03_STEPS = [
  'clean',
  'coat',
  'softbake',
  'expose',
  'develop',
  'inspect',
  'overlay',
] as const;
export type M03Step = (typeof M03_STEPS)[number];

export const LAST_STEP = M03_STEPS.length - 1;
const STAGES: readonly LithoStage[] = [
  'ox',
  'resist',
  'resist',
  'exposed',
  'developed',
  'developed',
  'developed',
];

export const NO_ALIGNMENT: Alignment = { dxNm: 0, dyNm: 0, rotationUrad: 0 };

export interface M03Session {
  readonly seed: number;
  /** The learner's choices for steps 3.2 – 3.6. */
  readonly recipe: ExposureInput;
  /** Index into `M03_STEPS`. */
  readonly step: number;
  /** Where the second mask would land with no correction, drawn from the seed. */
  readonly hidden: Alignment;
  /** The correction the resist on the wafer was exposed with. */
  readonly applied: Alignment;
  /** The correction dialled in for the next exposure (used from the next `rework` on). */
  readonly plan: Alignment;
  readonly reworks: number;
  /** The etch has begun: nothing can be changed any more. */
  readonly committed: boolean;
}

function assertStep(step: number): void {
  if (!Number.isInteger(step) || step < 0 || step > LAST_STEP) {
    throw new RangeError(`step must be a whole number from 0 to ${LAST_STEP}, got ${step}`);
  }
}

function assertEditable(s: M03Session): void {
  if (s.committed) {
    throw new Error('the session is committed: the etch has begun and nothing can be changed');
  }
}

/** What the cross-section shows at a step. */
export function stageOf(step: number): LithoStage {
  assertStep(step);
  return STAGES[step]!;
}

export function setRecipe(s: M03Session, patch: Partial<ExposureInput>): M03Session {
  assertEditable(s);
  return { ...s, recipe: { ...s.recipe, ...patch } };
}

export function goToStep(s: M03Session, step: number): M03Session {
  assertEditable(s);
  assertStep(step);
  return { ...s, step };
}

export function setPlan(s: M03Session, plan: Alignment): M03Session {
  assertEditable(s);
  for (const [name, value] of Object.entries(plan)) {
    if (!Number.isFinite(value)) throw new RangeError(`plan.${name} must be finite, got ${value}`);
  }
  return { ...s, plan: { ...plan } };
}

/** There is resist on the wafer to strip, and the etch has not begun. */
export function canRework(s: M03Session): boolean {
  return !s.committed && s.step >= 1;
}

/** Back to bare oxide and the first step; the dialled correction is what the next exposure uses. */
export function rework(s: M03Session): M03Session {
  assertEditable(s);
  if (!canRework(s)) throw new Error('there is no resist on the wafer to strip');
  return { ...s, step: 0, applied: s.plan, reworks: s.reworks + 1 };
}

/** Only from the last step: the learner has seen the overlay and chosen to go on. */
export function canCommit(s: M03Session): boolean {
  return !s.committed && s.step === LAST_STEP;
}

/** The etch begins. The session can no longer be changed. */
export function commit(s: M03Session): M03Session {
  assertEditable(s);
  if (!canCommit(s)) throw new Error('the etch can begin only after the last step');
  return { ...s, committed: true };
}
