import { describe, expect, it } from 'vitest';
import { dofNm } from '../../src/physics/aerial';
import type { LightSourceId } from '../../src/physics/constants';
import { M03_WINDOW } from '../../src/sim/defaults';
import { processWindowSpecFor as fromModel } from '../../src/sim/m03';
import { processWindowSpecFor } from '../../src/sim/windowSpec';

const SOURCES: LightSourceId[] = ['g', 'i', 'krf', 'arf'];

describe('processWindowSpecFor (sim/windowSpec.ts)', () => {
  it('is the function sim/m03 exports: the page and the worker ask for the same chart', () => {
    expect(fromModel).toBe(processWindowSpecFor);
  });

  it.each(SOURCES)('%s: dose ×0.7 … ×1.3 and ±1.5 DOF, 25 samples each', (source) => {
    const reach = M03_WINDOW.focusInDofs * dofNm(source);
    expect(processWindowSpecFor(source)).toEqual({
      doseMin: M03_WINDOW.doseMin,
      doseMax: M03_WINDOW.doseMax,
      doseSteps: M03_WINDOW.steps,
      defocusMinNm: -reach,
      defocusMaxNm: reach,
      defocusSteps: M03_WINDOW.steps,
    });
  });

  it('puts best focus and dose ×1 on a sample (the slider steps depend on it)', () => {
    const s = processWindowSpecFor('i');
    const dose = (k: number) => s.doseMin + ((s.doseMax - s.doseMin) * k) / (s.doseSteps - 1);
    const focus = (k: number) =>
      s.defocusMinNm + ((s.defocusMaxNm - s.defocusMinNm) * k) / (s.defocusSteps - 1);
    expect(dose(12)).toBeCloseTo(1, 12);
    expect(focus(12)).toBeCloseTo(0, 9);
  });
});
