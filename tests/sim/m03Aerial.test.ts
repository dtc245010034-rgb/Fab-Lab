import { describe, expect, it } from 'vitest';
import { dofNm } from '../../src/physics/aerial';
import { aerialProfile } from '../../src/physics/exposure';
import { DEFAULT_M03_RECIPE, M03_AERIAL } from '../../src/sim/defaults';
import { createSession, deriveView, goToStep, M03_STEPS, setRecipe } from '../../src/sim/m03';

describe('M03View.aerial', () => {
  it('is the aerial profile of the exposure on the view, over the range of the chart', () => {
    const s = setRecipe(createSession(1), { source: 'krf', designNm: 500, defocusNm: 120 });
    const view = deriveView(goToStep(s, 3));
    expect(view.aerial.xNm).toHaveLength(M03_AERIAL.samples);
    expect(view.aerial).toEqual(
      aerialProfile(view.exposure, {
        samples: M03_AERIAL.samples,
        rangeDefocusNm: M03_AERIAL.rangeInDofs * dofNm('krf'),
      }),
    );
  });

  it('does not depend on the step: the light is the same whenever it is asked for', () => {
    const first = deriveView(createSession(1)).aerial;
    for (let step = 1; step < M03_STEPS.length; step++) {
      expect(deriveView(goToStep(createSession(1), step)).aerial).toEqual(first);
    }
  });

  it('follows the recipe: more dose lowers both levels', () => {
    const at = (dose: number) =>
      deriveView(createSession(1, { ...DEFAULT_M03_RECIPE, dose })).aerial;
    expect(at(1.2).levelTop).toBeLessThan(at(0.8).levelTop);
    expect(at(1.2).levelFoot).toBeLessThan(at(0.8).levelFoot);
  });
});
