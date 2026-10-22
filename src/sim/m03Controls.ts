/**
 * Small helpers behind the M03 controls, kept free of the lithography model so the page can use
 * them (see tests/sim/pageSafe.test.ts): focus in depths of focus, a change of source, and when
 * the process-window chart has to be asked for again.
 */
import { dofNm } from '../physics/focus';
import type { LightSourceId } from '../physics/constants';
import type { ExposureInput } from '../physics/exposure';

/** A slider's range: values are `min`, `min + step`, … up to `max`. */
export interface ControlRange {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

/** Whether `value` is one the slider can take (a whole number of steps from its minimum). */
export function onGrid({ min, max, step }: ControlRange, value: number): boolean {
  if (!(value >= min - 1e-9 && value <= max + 1e-9)) return false;
  const steps = (value - min) / step;
  return Math.abs(steps - Math.round(steps)) < 1e-9;
}

/** A focus offset given in depths of focus of `source`, in nm. */
export function defocusNmFor(source: LightSourceId, dofs: number): number {
  return dofs * dofNm(source);
}

/** A focus offset in nm, in depths of focus of `source`. */
export function defocusInDofs(source: LightSourceId, defocusNm: number): number {
  return defocusNm / dofNm(source);
}

/**
 * Another source, the same number of depths of focus off: the focus the learner dialled is a
 * position on the chart, which spans ±1.5 DOF whatever the source, not a length in nm.
 */
export function changeSource(recipe: ExposureInput, source: LightSourceId): ExposureInput {
  if (source === recipe.source) return recipe;
  return {
    ...recipe,
    source,
    defocusNm: defocusNmFor(source, defocusInDofs(recipe.source, recipe.defocusNm)),
  };
}

/**
 * What the process-window chart depends on: everything but the dose and the focus, which the chart
 * sweeps itself (`processWindow` ignores them in its base recipe). Two recipes with the same key
 * give the same chart, so dragging the dose or the focus never asks for a new one.
 */
export function windowKey(recipe: ExposureInput): string {
  return JSON.stringify([
    recipe.spinRpm,
    recipe.source,
    recipe.designNm,
    recipe.polarity,
    recipe.softBake.tempC,
    recipe.softBake.timeMin,
    recipe.developMin,
  ]);
}
