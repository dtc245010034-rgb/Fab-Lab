/**
 * `?bench=1` asks the worker to time `runRecipe` on cases A, B, C. The worker waits until its
 * warm-up is over so every sample is a steady-state one, runs each case in turn, and sends back
 * only numbers (the big arrays never leave the worker).
 */
import * as Comlink from 'comlink';
import { afterEach, describe, expect, it } from 'vitest';
import { M04_CASES, warmUpRecipes } from '../../src/sim/cases';
import { runRecipe, type Recipe, type RecipeResult } from '../../src/sim/recipe';
import { SimService, type SimApi } from '../../src/workers/simService';
import { drive, manualYield, settle } from './helpers';

/** `compute` that reports the n-th call as taking n ms in total and n/2 ms of arrival search. */
function steppedCompute(log: Recipe[]) {
  return (recipe: Recipe): RecipeResult => {
    log.push(recipe);
    const n = log.length;
    return { ...runRecipe(recipe), timingsMs: { arrival: n / 2, total: n } };
  };
}

describe('SimService.bench', () => {
  it('runs each case runsPerCase times, case after case, and reports the times the computation measured', async () => {
    const gate = manualYield();
    const log: Recipe[] = [];
    const service = new SimService({
      yieldToEventLoop: gate.yieldToEventLoop,
      compute: steppedCompute(log),
    });
    const report = await drive(gate, service.bench(2));

    expect(log).toEqual([
      ...Array(2).fill(M04_CASES[0]!.recipe),
      ...Array(2).fill(M04_CASES[1]!.recipe),
      ...Array(2).fill(M04_CASES[2]!.recipe),
    ]);
    expect(report.cases.map((c) => c.id)).toEqual(['A', 'B', 'C']);
    expect(report.cases[0]).toEqual({ id: 'A', totalMs: [1, 2], arrivalMs: [0.5, 1] });
    expect(report.cases[2]).toEqual({ id: 'C', totalMs: [5, 6], arrivalMs: [2.5, 3] });
  });

  it('does not take a sample until the warm-up has finished', async () => {
    const gate = manualYield();
    const log: Recipe[] = [];
    const service = new SimService({
      yieldToEventLoop: gate.yieldToEventLoop,
      compute: steppedCompute(log),
      warmUp: warmUpRecipes(1),
    });
    const benched = service.bench(1);
    gate.release();
    await settle();
    expect(log).toHaveLength(0); // warm-up not started: bench waits for it

    service.startWarmUp();
    const warm = warmUpRecipes(1);
    for (let turn = 1; turn <= warm.length; turn++) {
      gate.release();
      await settle();
    }
    expect(log).toHaveLength(warm.length); // only warm-up so far
    const report = await drive(gate, benched);
    expect(log).toHaveLength(warm.length + 3);
    // the numbers of the samples are the 4th, 5th and 6th calls, not the warm-up ones
    expect(report.cases.map((c) => c.totalMs)).toEqual([[4], [5], [6]]);
  });

  it.each([0, -1, 1.5, NaN])('refuses %s runs per case', async (runs) => {
    const service = new SimService();
    await expect(service.bench(runs)).rejects.toThrow(RangeError);
  });
});

describe('SimService.bench over a Comlink channel', () => {
  const ports: MessagePort[] = [];
  afterEach(() => {
    ports.splice(0).forEach((p) => p.close());
  });

  it('answers with plain numbers only', async () => {
    const { port1, port2 } = new MessageChannel();
    ports.push(port1, port2);
    Comlink.expose(new SimService(), port2 as unknown as Comlink.Endpoint);
    const remote = Comlink.wrap<SimApi>(port1 as unknown as Comlink.Endpoint);

    const report = await remote.bench(2);
    expect(report.cases.map((c) => c.id)).toEqual(['A', 'B', 'C']);
    for (const c of report.cases) {
      expect(c.totalMs).toHaveLength(2);
      expect(c.arrivalMs).toHaveLength(2);
      for (const ms of [...c.totalMs, ...c.arrivalMs]) {
        expect(Number.isFinite(ms) && ms >= 0).toBe(true);
      }
      c.totalMs.forEach((total, i) => expect(total).toBeGreaterThanOrEqual(c.arrivalMs[i]!));
    }
  });
});
