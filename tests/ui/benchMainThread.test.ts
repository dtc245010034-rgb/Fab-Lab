/**
 * `?bench=1&thread=main` times the same SimService the worker runs, but on the page's own thread.
 * The JIT warms up per thread, so it must warm up exactly as the worker does (cases A, B, C three
 * times each) before its first measured run, or the comparison with the worker is not fair.
 */
import { describe, expect, it } from 'vitest';
import { M04_CASES, warmUpRecipes } from '../../src/sim/cases';
import { WARMUP_RUNS_PER_CASE } from '../../src/sim/defaults';
import { runRecipe, type Recipe } from '../../src/sim/recipe';
import { createMainThreadBench } from '../../src/ui/benchMainThread';

function counting() {
  const seen: Recipe[] = [];
  const compute = (recipe: Recipe) => {
    seen.push(recipe);
    return runRecipe(recipe);
  };
  return { seen, compute };
}

const recipeOf = (id: 'A' | 'B' | 'C') => M04_CASES.find((c) => c.id === id)!.recipe;

describe('createMainThreadBench', () => {
  it('warms up on A, B, C × 3 (the worker’s warm-up) before the first measured run', async () => {
    const { seen, compute } = counting();
    const bench = createMainThreadBench({ compute });
    await bench(2);

    const warm = WARMUP_RUNS_PER_CASE * M04_CASES.length;
    expect(warm).toBe(9);
    expect(seen.slice(0, warm)).toEqual(warmUpRecipes());
    // then the measured runs, case by case, `runsPerCase` each
    expect(seen.slice(warm)).toEqual(
      ['A', 'A', 'B', 'B', 'C', 'C'].map((id) => recipeOf(id as 'A' | 'B' | 'C')),
    );
  });

  it('reports the total and the arrival time of every measured run, case by case', async () => {
    const bench = createMainThreadBench();
    const report = await bench(3);
    expect(report.cases.map((c) => c.id)).toEqual(['A', 'B', 'C']);
    for (const c of report.cases) {
      expect(c.totalMs).toHaveLength(3);
      expect(c.arrivalMs).toHaveLength(3);
      for (const ms of [...c.totalMs, ...c.arrivalMs]) {
        expect(Number.isFinite(ms)).toBe(true);
        expect(ms).toBeGreaterThan(0);
      }
      c.totalMs.forEach((total, i) => expect(total).toBeGreaterThanOrEqual(c.arrivalMs[i]!));
    }
  });

  it('warms up once: measuring again on the same page does not warm up a second time', async () => {
    const { seen, compute } = counting();
    const bench = createMainThreadBench({ compute });
    await bench(2);
    await bench(2);
    expect(seen).toHaveLength(9 + 6 + 6);
  });

  it('rejects a number of runs that is not a whole number ≥ 1', async () => {
    const bench = createMainThreadBench();
    await expect(bench(0)).rejects.toThrow(RangeError);
  });
});
