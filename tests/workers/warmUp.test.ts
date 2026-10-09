/**
 * Warm-up: once the first real request has been answered the worker runs cases A, B, C three times
 * each, at idle, so the learner's next changes do not pay for the JIT. It must never delay a real
 * request by more than the computation already running, and it must say nothing to the page.
 *
 * It waits for the first real request on purpose: the page's first message is not yet delivered at
 * the worker's first turn of the event loop, so a warm-up that started at once would run a cold
 * case in front of the request the learner is waiting for (measured: +28 ms on a desktop).
 */
import * as Comlink from 'comlink';
import { afterEach, describe, expect, it } from 'vitest';
import { M04_CASES, warmUpRecipes } from '../../src/sim/cases';
import { WARMUP_RUNS_PER_CASE } from '../../src/sim/defaults';
import { runRecipe, type Recipe } from '../../src/sim/recipe';
import { SimService, type SimApi } from '../../src/workers/simService';
import { drive, manualYield, settle } from './helpers';

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

const first = M04_CASES[1]!.recipe; // what the Lab asks for at load: the default recipe, case B

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

/** Starts the warm-up and answers the first real request, as the page does at load. */
async function startAndServeFirst(s: ReturnType<typeof warmService>) {
  s.service.startWarmUp();
  const outcome = await drive(s.gate, s.service.run(1, first));
  expect(outcome.status).toBe('ok');
  expect(s.computed).toEqual([first]);
}

describe('SimService warm-up', () => {
  it('does nothing until it is started', async () => {
    const { gate, computed } = warmService();
    gate.release();
    await settle();
    expect(computed).toHaveLength(0);
  });

  it('waits for the first real request, however many idle turns the worker has had', async () => {
    const { service, gate, computed } = warmService();
    service.startWarmUp();
    for (let turn = 0; turn < 5; turn++) {
      gate.release();
      await settle();
    }
    expect(computed).toHaveLength(0); // nothing ran in front of the request that has not arrived yet

    // the request arrives after those idle turns, as the page's first message does
    const real = service.run(1, first);
    gate.release();
    await real;
    expect(computed).toEqual([first]);
  });

  it('then runs the scheduled recipes in order, one computation per turn of the event loop', async () => {
    const s = warmService();
    await startAndServeFirst(s);
    const schedule = warmUpRecipes();
    for (let turn = 1; turn <= schedule.length; turn++) {
      s.gate.release();
      await settle();
      expect(s.computed.slice(1), `after turn ${turn}`).toEqual(schedule.slice(0, turn));
    }
  });

  it('reports when it has finished, and only then', async () => {
    const s = warmService();
    let done = false;
    void s.service.warmedUp.then(() => {
      done = true;
    });
    await startAndServeFirst(s);
    for (let turn = 1; turn < 9; turn++) {
      s.gate.release();
      await settle();
    }
    expect(done).toBe(false);
    s.gate.release();
    await settle();
    expect(done).toBe(true);
  });

  it('is already finished when there is nothing to warm up', async () => {
    const { service } = warmService([]);
    service.startWarmUp();
    await service.warmedUp;
  });

  it('serves a real request on the very next turn, ahead of the rest of the warm-up', async () => {
    const s = warmService();
    await startAndServeFirst(s);
    s.gate.release(); // warm-up #1
    await settle();
    s.gate.release(); // warm-up #2
    await settle();
    expect(s.computed).toHaveLength(3);

    const real = s.service.run(2, M04_CASES[0]!.recipe);
    let warmDone = false;
    void s.service.warmedUp.then(() => {
      warmDone = true;
    });
    s.gate.release();
    const outcome = await real;
    expect(outcome.status).toBe('ok');
    expect(s.computed).toHaveLength(4);
    expect(s.computed[3]).toBe(M04_CASES[0]!.recipe); // the real one, not warm-up #3 (case C)
    expect(warmDone).toBe(false);

    // and the warm-up picks up where it left off
    s.gate.release();
    await settle();
    expect(s.computed[4]).toBe(M04_CASES[2]!.recipe);
  });

  it('starts after a first request that fails, too', async () => {
    const s = warmService();
    s.service.startWarmUp();
    const bad = s.service.run(1, { ...first, etch: { ...first.etch, timeMin: 15 } }); // beyond 14 min
    const refused = expect(bad).rejects.toThrow(RangeError);
    s.gate.release();
    await refused;
    s.gate.release();
    await settle();
    expect(s.computed.at(-1)).toBe(warmUpRecipes()[0]);
  });

  it('a warm-up that throws neither stops the rest nor reaches the page', async () => {
    const gate = manualYield();
    let calls = 0;
    const service = new SimService({
      yieldToEventLoop: gate.yieldToEventLoop,
      compute: (recipe) => {
        calls++;
        if (calls === 2) throw new RangeError('warm-up recipe refused'); // the first warm-up run
        return runRecipe(recipe);
      },
      warmUp: warmUpRecipes(1),
    });
    service.startWarmUp();
    await drive(gate, service.run(1, first));
    await drive(gate, service.warmedUp);
    expect(calls).toBe(1 + 3);
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
    const outcome = await remote.run(1, first);
    expect(outcome.status).toBe('ok');
    await service.warmedUp;
    await settle();
    expect(messages).toBe(1);
  });
});
