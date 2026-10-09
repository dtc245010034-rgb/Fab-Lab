/**
 * The client is the main-thread half: it numbers requests, drops answers to requests a newer one
 * has replaced, and checks what comes back before the UI draws it. The worker is a fake whose
 * answers the test settles by hand, in any order.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_RECIPE } from '../../src/sim/defaults';
import { runRecipe, type RecipeResult } from '../../src/sim/recipe';
import type { RunOutcome } from '../../src/workers/simService';
import { createSimClient } from '../../src/workers/simClient';
import { BASE_LITHO, wet } from '../sim/helpers';

const caseA = { litho: BASE_LITHO, etch: wet('boe6', 3.3) };
const resultB = runRecipe(DEFAULT_RECIPE);
const resultA = runRecipe(caseA);

/** A fake worker: every run() call waits until the test settles it. */
function fakeRemote() {
  const calls: {
    id: number;
    resolve: (o: RunOutcome) => void;
    reject: (e: unknown) => void;
  }[] = [];
  const remote = {
    run: (id: number) =>
      new Promise<RunOutcome>((resolve, reject) => calls.push({ id, resolve, reject })),
  };
  const ok = (id: number, result: RecipeResult): RunOutcome => ({ status: 'ok', id, result });
  return { remote, calls, ok };
}

describe('createSimClient.run', () => {
  it('resolves with the result of the only request', async () => {
    const { remote, calls, ok } = fakeRemote();
    const client = createSimClient(remote, () => {});
    const pending = client.run(DEFAULT_RECIPE);
    calls[0]!.resolve(ok(calls[0]!.id, resultB));
    expect(await pending).toBe(resultB);
  });

  it('numbers requests so that each answer can be matched to its request', async () => {
    const { remote, calls } = fakeRemote();
    const client = createSimClient(remote, () => {});
    void client.run(DEFAULT_RECIPE);
    void client.run(caseA);
    expect(calls[1]!.id).toBeGreaterThan(calls[0]!.id);
  });

  it('drops the late answer to a request a newer one has replaced', async () => {
    const { remote, calls, ok } = fakeRemote();
    const client = createSimClient(remote, () => {});
    const older = client.run(DEFAULT_RECIPE);
    const newer = client.run(caseA);
    // the newer answer lands first, then the old one limps in
    calls[1]!.resolve(ok(calls[1]!.id, resultA));
    calls[0]!.resolve(ok(calls[0]!.id, resultB));
    expect(await newer).toBe(resultA);
    expect(await older).toBeNull();
  });

  it('drops the old answer even if it is the only one to arrive before the new one', async () => {
    const { remote, calls, ok } = fakeRemote();
    const client = createSimClient(remote, () => {});
    const older = client.run(DEFAULT_RECIPE);
    const newer = client.run(caseA);
    calls[0]!.resolve(ok(calls[0]!.id, resultB));
    expect(await older).toBeNull();
    calls[1]!.resolve(ok(calls[1]!.id, resultA));
    expect(await newer).toBe(resultA);
  });

  it('turns "superseded" from the worker into null', async () => {
    const { remote, calls } = fakeRemote();
    const client = createSimClient(remote, () => {});
    const pending = client.run(DEFAULT_RECIPE);
    calls[0]!.resolve({ status: 'superseded', id: calls[0]!.id });
    expect(await pending).toBeNull();
  });

  it('reports an error of the newest request, and ignores the error of an older one', async () => {
    const { remote, calls } = fakeRemote();
    const client = createSimClient(remote, () => {});
    const older = client.run(DEFAULT_RECIPE);
    const newer = client.run(caseA);
    calls[0]!.reject(new RangeError('old'));
    calls[1]!.reject(new RangeError('new'));
    expect(await older).toBeNull();
    await expect(newer).rejects.toThrow('new');
  });

  it('refuses an answer whose arrival field has no usable maxTimeMin', async () => {
    const { remote, calls, ok } = fakeRemote();
    const client = createSimClient(remote, () => {});
    const pending = client.run(DEFAULT_RECIPE);
    const { arrival } = resultB.field;
    const broken = { ...resultB, field: { arrival } } as unknown as RecipeResult;
    calls[0]!.resolve(ok(calls[0]!.id, broken));
    await expect(pending).rejects.toThrow(/maxTimeMin/);
  });

  it('refuses an answer whose arrival does not match the grid (e.g. a detached buffer)', async () => {
    const { remote, calls, ok } = fakeRemote();
    const client = createSimClient(remote, () => {});
    const pending = client.run(DEFAULT_RECIPE);
    const short = {
      ...resultB,
      field: { arrival: new Float64Array(3), maxTimeMin: 14 },
    } as RecipeResult;
    calls[0]!.resolve(ok(calls[0]!.id, short));
    await expect(pending).rejects.toThrow(/arrival/);
  });
});

describe('createSimClient.abort / dispose', () => {
  it('abort rejects the request in flight, so a dead worker cannot leave the UI waiting', async () => {
    const { remote } = fakeRemote();
    const client = createSimClient(remote, () => {});
    const pending = client.run(DEFAULT_RECIPE);
    client.abort(new Error('worker crashed'));
    await expect(pending).rejects.toThrow('worker crashed');
  });

  it('abort leaves a request that a newer one already replaced quiet', async () => {
    const { remote, calls, ok } = fakeRemote();
    const client = createSimClient(remote, () => {});
    const older = client.run(DEFAULT_RECIPE);
    const newer = client.run(caseA);
    client.abort(new Error('worker crashed'));
    await expect(newer).rejects.toThrow('worker crashed');
    expect(await older).toBeNull();
    calls[0]!.resolve(ok(calls[0]!.id, resultB)); // a straggler after abort changes nothing
  });

  it('dispose calls the cleanup it was given, once', () => {
    const { remote } = fakeRemote();
    let disposed = 0;
    const client = createSimClient(remote, () => {
      disposed++;
    });
    client.dispose();
    client.dispose();
    expect(disposed).toBe(1);
  });

  it('answers nothing after dispose: run resolves null', async () => {
    const { remote } = fakeRemote();
    const client = createSimClient(remote, () => {});
    client.dispose();
    expect(await client.run(DEFAULT_RECIPE)).toBeNull();
  });
});
