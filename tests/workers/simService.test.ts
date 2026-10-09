/**
 * SimService is what the worker exposes. The mailbox rules (a newer request replaces one that has
 * not started, nothing computes before the event loop has had a turn) are checked with a manual
 * "yield" so the order is deterministic; the Comlink transfer is checked over a real
 * MessageChannel, which is the same protocol the browser Worker speaks.
 */
import * as Comlink from 'comlink';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_RECIPE } from '../../src/sim/defaults';
import { runRecipe, type Recipe, type RecipeResult } from '../../src/sim/recipe';
import { SimService, type SimApi } from '../../src/workers/simService';
import { BASE_LITHO, rie, wet } from '../sim/helpers';

/** A yield the test releases by hand, so requests can pile up "while the worker is busy". */
function manualYield() {
  const waiters: (() => void)[] = [];
  return {
    yieldToEventLoop: () => new Promise<void>((resolve) => waiters.push(resolve)),
    release: () => waiters.splice(0).forEach((resolve) => resolve()),
  };
}

const caseA: Recipe = { litho: BASE_LITHO, etch: wet('boe6', 3.3) };

function countingService() {
  const gate = manualYield();
  const computed: Recipe[] = [];
  const service = new SimService({
    yieldToEventLoop: gate.yieldToEventLoop,
    compute: (recipe) => {
      computed.push(recipe);
      return runRecipe(recipe);
    },
  });
  return { service, gate, computed };
}

describe('SimService.run', () => {
  it('answers with the result runRecipe gives for the same recipe', async () => {
    const { service, gate } = countingService();
    const pending = service.run(1, DEFAULT_RECIPE);
    gate.release();
    const outcome = await pending;
    expect(outcome.status).toBe('ok');
    if (outcome.status !== 'ok') return;
    const direct = runRecipe(DEFAULT_RECIPE);
    expect(outcome.id).toBe(1);
    expect(outcome.result.metrics).toEqual(direct.metrics);
    expect(outcome.result.field.arrival).toEqual(direct.field.arrival);
    expect(outcome.result.field.maxTimeMin).toBe(14);
  });

  it('does not compute until the event loop has had a turn', () => {
    const { service, computed } = countingService();
    void service.run(1, DEFAULT_RECIPE);
    expect(computed).toHaveLength(0);
  });

  it('lets a newer request replace the ones that have not started', async () => {
    const { service, gate, computed } = countingService();
    const first = service.run(1, DEFAULT_RECIPE);
    const second = service.run(2, caseA);
    const third = service.run(3, { litho: BASE_LITHO, etch: rie(80, 180, 9) });
    gate.release();
    expect(await first).toEqual({ status: 'superseded', id: 1 });
    expect(await second).toEqual({ status: 'superseded', id: 2 });
    const last = await third;
    expect(last.status).toBe('ok');
    expect(last.id).toBe(3);
    expect(computed).toHaveLength(1);
    expect(computed[0]!.etch).toEqual(rie(80, 180, 9));
  });

  it('serves a request that arrives after an earlier one finished', async () => {
    const { service, gate } = countingService();
    const first = service.run(1, DEFAULT_RECIPE);
    gate.release();
    expect((await first).status).toBe('ok');
    const second = service.run(2, caseA);
    gate.release();
    const outcome = await second;
    expect(outcome.status).toBe('ok');
    expect(outcome.id).toBe(2);
  });

  it('rejects a recipe runRecipe refuses, and keeps serving afterwards', async () => {
    const { service, gate } = countingService();
    // 15 min is beyond the 14 min the RIE time control offers
    const bad = service.run(1, { litho: BASE_LITHO, etch: rie(200, 30, 15) });
    gate.release();
    await expect(bad).rejects.toThrow(RangeError);
    const good = service.run(2, DEFAULT_RECIPE);
    gate.release();
    expect((await good).status).toBe('ok');
  });
});

describe('SimService over a Comlink channel', () => {
  const ports: MessagePort[] = [];
  afterEach(() => {
    ports.splice(0).forEach((p) => p.close());
  });

  function connect(service: SimService) {
    const { port1, port2 } = new MessageChannel();
    ports.push(port1, port2);
    Comlink.expose(service, port2 as unknown as Comlink.Endpoint);
    return Comlink.wrap<SimApi>(port1 as unknown as Comlink.Endpoint);
  }

  it('transfers field.arrival, always with maxTimeMin, and leaves the worker side detached', async () => {
    const kept: RecipeResult[] = [];
    const service = new SimService({
      compute: (recipe) => {
        const result = runRecipe(recipe);
        kept.push(result);
        return result;
      },
    });
    const remote = connect(service);

    const outcome = await remote.run(7, DEFAULT_RECIPE);
    expect(outcome.status).toBe('ok');
    if (outcome.status !== 'ok') return;
    const { field, section } = outcome.result;
    const direct = runRecipe(DEFAULT_RECIPE);

    expect(field.arrival).toBeInstanceOf(Float64Array);
    expect(field.arrival).toHaveLength(section.widthCells * section.heightCells);
    expect(field.maxTimeMin).toBe(14);
    expect(field.arrival).toEqual(direct.field.arrival);
    expect(outcome.result.metrics).toEqual(direct.metrics);
    // Transferred, not copied: the worker no longer owns the memory.
    expect(kept[0]!.field.arrival.byteLength).toBe(0);
  });

  it('copies instead of transferring when arrival is a view into a larger buffer', async () => {
    // Transferring `arrival.buffer` would hand over (and detach) the whole shared buffer.
    const pool = new ArrayBuffer(1 << 20);
    const kept: RecipeResult[] = [];
    const service = new SimService({
      compute: (recipe) => {
        const result = runRecipe(recipe);
        const view = new Float64Array(pool, 64, result.field.arrival.length);
        view.set(result.field.arrival);
        const pooled = { ...result, field: { ...result.field, arrival: view } };
        kept.push(pooled);
        return pooled;
      },
    });
    const remote = connect(service);

    const outcome = await remote.run(1, DEFAULT_RECIPE);
    expect(outcome.status).toBe('ok');
    if (outcome.status !== 'ok') return;
    expect(outcome.result.field.arrival).toEqual(runRecipe(DEFAULT_RECIPE).field.arrival);
    expect(pool.byteLength).toBe(1 << 20); // the pool is still ours
    expect(kept[0]!.field.maxTimeMin).toBe(14);
  });

  it('carries Infinity (wet etch does not attack resist) through the clone', async () => {
    const remote = connect(new SimService());
    const outcome = await remote.run(1, caseA);
    expect(outcome.status).toBe('ok');
    if (outcome.status !== 'ok') return;
    expect(outcome.result.rates.resistSelectivity).toBe(Infinity);
  });
});
