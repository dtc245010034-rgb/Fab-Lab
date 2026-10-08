/**
 * `runRecipe` is the glue the Viewer (and, from S0.4, the worker) calls: litho → grid → etch rates →
 * arrival time → metrics. It must agree with the test-only glue in helpers.ts, which the S0.2
 * regression tests are written against, and with the case-B row of docs/modules/m04-etch.md.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_RECIPE } from '../../src/sim/defaults';
import { etchTimeMaxMin, runRecipe, type EtchStep } from '../../src/sim/recipe';
import { BASE_LITHO, rie, simulate, wet } from './helpers';

describe('DEFAULT_RECIPE (case B of m04-etch.md)', () => {
  it('is RIE 200 W, 30 mTorr, 4.6 min on the base litho with an 800 nm window', () => {
    expect(DEFAULT_RECIPE.etch).toEqual({
      mode: 'dry',
      powerW: 200,
      pressureMTorr: 30,
      timeMin: 4.6,
    });
    expect(DEFAULT_RECIPE.litho).toEqual(BASE_LITHO);
  });
});

describe('runRecipe', () => {
  it('reproduces case B: cleared, top ≈820, bottom ≈800, wall ≈88° (±20 nm, ±2°)', () => {
    const { metrics: m } = runRecipe(DEFAULT_RECIPE);
    expect(m.cleared).toBe(true);
    expect(Math.abs(m.topNm - 820)).toBeLessThanOrEqual(20);
    expect(Math.abs(m.bottomNm - 800)).toBeLessThanOrEqual(20);
    expect(Math.abs(m.sidewallAngleDeg - 88)).toBeLessThanOrEqual(2);
  });

  it('gives exactly what the test-only glue gives, field and metrics', () => {
    const recipe = { litho: BASE_LITHO, etch: rie(200, 30, 4.6) };
    const prod = runRecipe(recipe);
    const test = simulate(recipe, undefined, { maxTimeMin: 14 });
    expect(prod.metrics).toEqual(test.metrics);
    expect(prod.field.maxTimeMin).toBe(test.field.maxTimeMin);
    expect(prod.field.arrival).toEqual(test.field.arrival);
    expect(prod.section.materials).toEqual(test.section.materials);
  });

  it('computes the field up to the slider maximum, not the chosen time', () => {
    expect(runRecipe(DEFAULT_RECIPE).field.maxTimeMin).toBe(14);
    expect(runRecipe({ litho: BASE_LITHO, etch: wet('boe6', 3.3) }).field.maxTimeMin).toBe(8);
    expect(runRecipe({ litho: BASE_LITHO, etch: wet('hf49', 0.2) }).field.maxTimeMin).toBe(0.5);
  });

  it('refuses a time beyond the slider maximum instead of under-reporting the etch', () => {
    expect(() => runRecipe({ litho: BASE_LITHO, etch: rie(200, 30, 15) })).toThrow(RangeError);
  });

  it('reports non-negative timings with the arrival search inside the total', () => {
    const { timingsMs } = runRecipe(DEFAULT_RECIPE);
    expect(Number.isFinite(timingsMs.arrival)).toBe(true);
    expect(timingsMs.arrival).toBeGreaterThanOrEqual(0);
    expect(timingsMs.total).toBeGreaterThanOrEqual(timingsMs.arrival);
  });
});

describe('etchTimeMaxMin', () => {
  const cases: [string, EtchStep, number][] = [
    ['BOE 10:1', wet('boe10', 1), 8],
    ['BOE 6:1', wet('boe6', 1), 8],
    ['HF 49 %', wet('hf49', 0.1), 0.5],
    ['RIE', rie(200, 30, 1), 14],
  ];
  it.each(cases)('%s → %d min', (_name, step, expected) => {
    expect(etchTimeMaxMin(step)).toBe(expected);
  });
});
