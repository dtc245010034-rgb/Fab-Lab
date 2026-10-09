// Harness page. ?where=main runs the SimService on this page's main thread, the only place Chrome's
// CPU throttling reaches; otherwise it runs in a Worker, as in production.
import * as Comlink from 'comlink';
import type { Recipe } from '../../src/sim/recipe';
import type { SimApi } from '../../src/workers/simService';
import { makeService } from './service';

const params = new URLSearchParams(location.search);
let remote: SimApi;
if (params.get('where') === 'main') {
  const service = makeService(params);
  service.startWarmUp();
  remote = service;
} else {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), {
    type: 'module',
    name: params.toString(),
  });
  remote = Comlink.wrap<SimApi>(worker);
}

let id = 0;
(window as unknown as Record<string, unknown>).measure = {
  bench: (runsPerCase: number) => remote.bench(runsPerCase),
  /** One real request: round trip as the page sees it, and the time the computation itself took. */
  async run(recipe: Recipe) {
    const start = performance.now();
    const outcome = await remote.run(++id, recipe);
    return {
      ms: performance.now() - start,
      status: outcome.status,
      inWorkerMs: outcome.status === 'ok' ? outcome.result.timingsMs.total : null,
    };
  },
};
