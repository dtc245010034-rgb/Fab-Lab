/**
 * The axes of the process-window chart. Apart from sim/m03.ts so that the page can ask for the
 * chart without carrying the lithography model, which runs in the worker; sim/m03.ts re-exports it.
 */
import { dofNm } from '../physics/focus';
import type { LightSourceId } from '../physics/constants';
import type { ProcessWindowSpec } from '../physics/processWindow';
import { M03_WINDOW } from './defaults';

/** The chart's axes for a source: dose ×0.7 … ×1.3 and ±1.5 DOF, both 25 samples, (×1, 0) on a sample. */
export function processWindowSpecFor(source: LightSourceId): ProcessWindowSpec {
  const reachNm = M03_WINDOW.focusInDofs * dofNm(source);
  return {
    doseMin: M03_WINDOW.doseMin,
    doseMax: M03_WINDOW.doseMax,
    doseSteps: M03_WINDOW.steps,
    defocusMinNm: -reachNm,
    defocusMaxNm: reachNm,
    defocusSteps: M03_WINDOW.steps,
  };
}
