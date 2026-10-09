/**
 * `?bench=1&thread=main`: the same SimService the worker runs, on the page's own thread, so the
 * two can be compared on one device (is the worker slower than the main thread there?).
 *
 * A diagnostic of the benchmark page only. The lab never computes here (CLAUDE.md: heavy compute
 * always in the worker), and this file is loaded with `import()` so that it stays out of the
 * main bundle. The JIT warms up per thread, so this service gets the worker's own warm-up.
 */
import { warmUpRecipes } from '../sim/cases';
import { SimService, type SimServiceOptions } from '../workers/simService';
import type { MainBench } from './benchStore';

/**
 * One service for the life of the page, so that measuring again does not warm up again (the
 * worker warms up once per page too). `compute` is for tests.
 */
export function createMainThreadBench({
  compute,
}: Pick<SimServiceOptions, 'compute'> = {}): MainBench {
  const service = new SimService({ warmUp: warmUpRecipes(), compute });
  service.startWarmUp(); // runs once `bench` releases it
  return (runsPerCase) => service.bench(runsPerCase);
}
