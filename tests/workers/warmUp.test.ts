/**
 * Warm-up: after the worker has started it runs cases A, B, C three times each, at idle, so the
 * learner's first changes do not pay for the JIT. It must never delay a real request by more than
 * the computation already running, and it must say nothing to the page.
 */
import * as Comlink from 'comlink';
import { afterEach, describe, expect, it } from 'vitest';
import { M04_CASES } from '../../src/sim/cases';
import { WARMUP_RUNS_PER_CASE } from '../../src/sim/defaults';
import { warmUpRecipes } from '../../src/sim/cases';
import { runRecipe, type Recipe } from '../../src/sim/recipe';
import { SimService, type SimApi } from '../../src/workers/simService';
import { manualYield, settle } from './helpers';

describe('warmUpRecipes', () => {
  it('is A, B, C repeated round-robin, WARMUP_RUNS_PER_CASE times: 9 runs', () => {
    expect(WARMUP_RUNS_PER_CASE).toBe(3);
    const recipes = warmUpRecipes();
    expect(recipes).toHaveLength(9);
    const ids = M04_CASES.map((c) => c.recipe);
    expect(recipes).toEqual([...ids, ...ids, ...ids]);
  });

  it('follows the number of runs asked for', () => {
    expect(warmUpRecipes(1)).toEqual(M04_CASES.map((c) => c.recipe));
    expect(warmUpRecipes(0)).toEqual([]);
  });
});

function warmService(warmUp: Recipe[] = warmUpRecipes()) {
  const gate = manualYield();
  const computed: Recipe[] = [];
  const service = new SimService({
    yieldToEventLoop: gate.yieldToEventLoop,
    compute: (recipe) => {
      computed.push(recipe);
      return runRecipe(recipe);
    },
    warmUp,
  });
  return { service, gate, computed };
}

describe('SimService warm-up', () => {
  it('does nothing until it is started', async () => {
    const { gate, computed } = warmService();
    gate.release();
    await settle();
    expect(computed).toHaveLength(0);
  });

  it('runs the scheduled recipes in order, one computation per turn of the event loop', async () => {
    const { service, gate, computed } = warmService();
    service.startWarmUp();
    expect(computed).toHaveLength(0); // it yields before the first one
    const schedule = warmUpRecipes();
    for (let turn = 1; turn <= schedule.length; turn++) {
      gate.release();
      await settle();
      expect(computed, `after turn ${turn}`).toEqual(schedule.slice(0, turn));
    }
  });

  it('reports when it has finished, and only then', async () => {
    const { service, gate } = warmService();
    let done = false;
    void service.warmedUp.then(() => {
      done = true;
    });
    service.startWarmUp();
    for (let turn = 1; turn < 9; turn++) {
      gate.release();
      await settle();
    }
    expect(done).toBe(false);
    gate.release();
    await settle();
    expect(done).toBe(true);
  });

  it('is already finished when there is nothing to warm up', async () => {
    const { service } = warmService([]);
    service.startWarmUp();
    await service.warmedUp;
  });

  it('serves a real request on the very next turn, ahead of the rest of the warm-up', async () => {
    const { service, gate, computed } = warmService();
    service.startWarmUp();
    gate.release(); // warm-up #1
    await settle();
    gate.release(); // warm-up #2
    await settle();
    expect(computed).toHaveLength(2);

    const real = service.run(1, M04_CASES[0]!.recipe);
    let warmDone = false;
    void service.warmedUp.then(() => {
      warmDone = true;
    });
    gate.release();
    const outcome = await real;
    expect(outcome.status).toBe('ok');
    expect(computed).toHaveLength(3);
    expect(computed[2]).toBe(M04_CASES[0]!.recipe); // the real one, not warm-up #3 (case C)
    expect(warmDone).toBe(false);

    // and the warm-up picks up where it left off
    gate.release();
    await settle();
    expect(computed[3]).toBe(M04_CASES[2]!.recipe);
  });

  it('computes a request that is already waiting before any warm-up at all', async () => {
    const { service, gate, computed } = warmService();
    const real = service.run(1, M04_CASES[1]!.recipe);
    service.startWarmUp();
    gate.release();
    await real;
    expect(computed[0]).toBe(M04_CASES[1]!.recipe);
    expect(computed).toHaveLength(1);
  });

  it('a warm-up that throws neither stops the rest nor reaches the page', async () => {
    const gate = manualYield();
    let calls = 0;
    const service = new SimService({
      yieldToEventLoop: gate.yieldToEventLoop,
      compute: (recipe) => {
        calls++;
        if (calls === 1) throw new RangeError('warm-up recipe refused');
        return runRecipe(recipe);
      },
      warmUp: warmUpRecipes(1),
    });
    service.startWarmUp();
    for (let turn = 0; turn < 3; turn++) {
      gate.release();
      await settle();
    }
    await service.warmedUp;
    expect(calls).toBe(3);
  });
});

describe('SimService warm-up over a Comlink channel', () => {
  const ports: MessagePort[] = [];
  afterEach(() => {
    ports.splice(0).forEach((p) => p.close());
  });

  it('posts nothing to the page: the only message is the answer to the real request', async () => {
    const { port1, port2 } = new MessageChannel();
    ports.push(port1, port2);
    const service = new SimService({ warmUp: warmUpRecipes(1) });
    Comlink.expose(service, port2 as unknown as Comlink.Endpoint);
    const remote = Comlink.wrap<SimApi>(port1 as unknown as Comlink.Endpoint);
    let messages = 0;
    port1.addEventListener('message', () => messages++);

    service.startWarmUp();
    const outcome = await remote.run(1, M04_CASES[1]!.recipe);
    expect(outcome.status).toBe('ok');
    await service.warmedUp;
    await settle();
    expect(messages).toBe(1);
  });
});
