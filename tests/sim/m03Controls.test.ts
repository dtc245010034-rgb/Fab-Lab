import { describe, expect, it } from 'vitest';
import { dofNm } from '../../src/physics/aerial';
import type { LightSourceId } from '../../src/physics/constants';
import { processWindow } from '../../src/physics/processWindow';
import { DEFAULT_M03_RECIPE, M03_CONTROLS, M03_WINDOW } from '../../src/sim/defaults';
import {
  changeSource,
  defocusInDofs,
  defocusNmFor,
  onGrid,
  windowKey,
} from '../../src/sim/m03Controls';
import { processWindowSpecFor } from '../../src/sim/windowSpec';

const SOURCES: LightSourceId[] = ['g', 'i', 'krf', 'arf'];

describe('M03_CONTROLS', () => {
  it('starts from a value the slider can actually take, for every control', () => {
    const r = DEFAULT_M03_RECIPE;
    const values = {
      spinRpm: r.spinRpm,
      designNm: r.designNm,
      dose: r.dose,
      defocusInDofs: defocusInDofs(r.source, r.defocusNm),
      softBakeTempC: r.softBake.tempC,
      softBakeTimeMin: r.softBake.timeMin,
      developMin: r.developMin,
    };
    for (const [name, value] of Object.entries(values)) {
      const c = M03_CONTROLS[name as keyof typeof M03_CONTROLS];
      expect(onGrid(c, value), `${name} = ${value}`).toBe(true);
    }
  });

  it('steps the dose and the focus by exactly one column and one row of the chart', () => {
    const { doseMin, doseMax, focusInDofs, steps } = M03_WINDOW;
    expect(M03_CONTROLS.dose.step).toBeCloseTo((doseMax - doseMin) / (steps - 1), 12);
    expect(M03_CONTROLS.dose.min).toBe(doseMin);
    expect(M03_CONTROLS.dose.max).toBe(doseMax);
    expect(M03_CONTROLS.defocusInDofs.step).toBeCloseTo((2 * focusInDofs) / (steps - 1), 12);
    expect(M03_CONTROLS.defocusInDofs.min).toBe(-focusInDofs);
    expect(M03_CONTROLS.defocusInDofs.max).toBe(focusInDofs);
  });

  it('has min < max and a step that divides the range, everywhere', () => {
    for (const [name, c] of Object.entries(M03_CONTROLS)) {
      expect(c.min, name).toBeLessThan(c.max);
      const n = (c.max - c.min) / c.step;
      expect(Math.abs(n - Math.round(n)), `${name}: ${n} steps`).toBeLessThan(1e-9);
    }
  });
});

describe('onGrid', () => {
  it('accepts values a whole number of steps from the minimum, with float noise, and refuses others', () => {
    const c = { min: 0.7, max: 1.3, step: 0.025 };
    expect(onGrid(c, 0.7)).toBe(true);
    expect(onGrid(c, 0.7 + 0.025 * 13)).toBe(true);
    expect(onGrid(c, 1.3)).toBe(true);
    expect(onGrid(c, 1.01)).toBe(false);
    expect(onGrid(c, 1.4)).toBe(false);
  });
});

describe('focus in DOF', () => {
  it.each(SOURCES)('%s: nm and DOF convert both ways', (source) => {
    expect(defocusNmFor(source, 1)).toBeCloseTo(dofNm(source), 9);
    expect(defocusNmFor(source, -0.5)).toBeCloseTo(-dofNm(source) / 2, 9);
    expect(defocusInDofs(source, defocusNmFor(source, 0.75))).toBeCloseTo(0.75, 12);
  });

  it('changing the source keeps the same number of DOF, not the same nm, and leaves the rest', () => {
    const before = { ...DEFAULT_M03_RECIPE, defocusNm: defocusNmFor('i', 0.5) };
    const after = changeSource(before, 'arf');
    expect(after.source).toBe('arf');
    expect(defocusInDofs('arf', after.defocusNm)).toBeCloseTo(0.5, 12);
    expect({ ...after, source: 'i', defocusNm: before.defocusNm }).toEqual(before);
  });

  it('is a no-op for the source already chosen', () => {
    expect(changeSource(DEFAULT_M03_RECIPE, 'i')).toBe(DEFAULT_M03_RECIPE);
  });
});

describe('windowKey: when the chart has to be asked for again', () => {
  const r = DEFAULT_M03_RECIPE;

  it('ignores the dose and the focus, which the chart sweeps itself', () => {
    expect(windowKey({ ...r, dose: 1.2, defocusNm: 100 })).toBe(windowKey(r));
  });

  it.each([
    ['spinRpm', { spinRpm: 4000 }],
    ['source', { source: 'krf' as const }],
    ['designNm', { designNm: 900 }],
    ['polarity', { polarity: 'negative' as const }],
    ['bake temperature', { softBake: { tempC: 100, timeMin: 1 } }],
    ['bake time', { softBake: { tempC: 90, timeMin: 2 } }],
    ['develop time', { developMin: 1.4 }],
  ])('changes with the %s', (_name, patch) => {
    expect(windowKey({ ...r, ...patch })).not.toBe(windowKey(r));
  });

  it('is enough: two recipes with the same key give the very same chart (the claim processWindow makes)', () => {
    const spec = processWindowSpecFor('i');
    const a = processWindow({ ...r, dose: 0.8, defocusNm: 300 }, spec);
    const b = processWindow({ ...r, dose: 1.25, defocusNm: -200 }, spec);
    expect(windowKey({ ...r, dose: 0.8, defocusNm: 300 })).toBe(
      windowKey({ ...r, dose: 1.25, defocusNm: -200 }),
    );
    expect(a.pass).toEqual(b.pass);
    expect(a.cdNm).toEqual(b.cdNm);
  });
});
