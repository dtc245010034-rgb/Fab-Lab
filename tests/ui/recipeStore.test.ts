/**
 * The store between the worker client and React: the last good result stays while the next one is
 * computed, the picture and the recipe it was computed from stay together, and the worker lives
 * exactly as long as somebody is listening (React StrictMode subscribes, unsubscribes, subscribes).
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_RECIPE } from '../../src/sim/defaults';
import { runRecipe, type Recipe } from '../../src/sim/recipe';
import { createRecipeStore } from '../../src/ui/recipeStore';
import { BASE_LITHO, wet } from '../sim/helpers';
import { manualClient, type TestClient } from './clients';

const caseA: Recipe = { litho: BASE_LITHO, etch: wet('boe6', 3.3) };
const resultB = runRecipe(DEFAULT_RECIPE);
const resultA = runRecipe(caseA);

/** A store whose clients the test can settle by hand; `made` lists every client it created. */
function setup() {
  const made: ReturnType<typeof manualClient>[] = [];
  const store = createRecipeStore(() => {
    const m = manualClient();
    made.push(m);
    return m.client as TestClient;
  });
  return { store, made, current: () => made.at(-1)! };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createRecipeStore', () => {
  it('starts empty: nothing shown, nothing pending, no error', () => {
    const { store } = setup();
    expect(store.getSnapshot()).toEqual({ shown: null, pending: false, error: null });
  });

  it('creates no worker until somebody listens', () => {
    const { store, made } = setup();
    store.request(DEFAULT_RECIPE);
    expect(made).toHaveLength(0);
    store.subscribe(() => {});
    expect(made).toHaveLength(1);
  });

  it('runs the recipe asked for before the first listener came', async () => {
    const { store, current } = setup();
    store.request(DEFAULT_RECIPE);
    store.subscribe(() => {});
    expect(current().client.asked).toEqual([DEFAULT_RECIPE]);
    expect(store.getSnapshot().pending).toBe(true);
    current().runs[0]!.resolve(resultB);
    await flush();
    expect(store.getSnapshot()).toEqual({
      shown: { recipe: DEFAULT_RECIPE, result: resultB },
      pending: false,
      error: null,
    });
  });

  it('keeps the old result, with the recipe it belongs to, while the next one is computed', async () => {
    const { store, current } = setup();
    store.subscribe(() => {});
    store.request(DEFAULT_RECIPE);
    current().runs[0]!.resolve(resultB);
    await flush();

    store.request(caseA);
    const during = store.getSnapshot();
    expect(during.pending).toBe(true);
    expect(during.shown).toEqual({ recipe: DEFAULT_RECIPE, result: resultB });

    current().runs[1]!.resolve(resultA);
    await flush();
    expect(store.getSnapshot().shown).toEqual({ recipe: caseA, result: resultA });
    expect(store.getSnapshot().pending).toBe(false);
  });

  it('stays pending when the answer is null (a newer request replaced it)', async () => {
    const { store, current } = setup();
    store.subscribe(() => {});
    store.request(DEFAULT_RECIPE);
    store.request(caseA);
    current().runs[0]!.resolve(null); // the old one, dropped by the client
    await flush();
    expect(store.getSnapshot()).toEqual({ shown: null, pending: true, error: null });
    current().runs[1]!.resolve(resultA);
    await flush();
    expect(store.getSnapshot().shown?.recipe).toBe(caseA);
  });

  it('keeps the old result and reports the error when a computation fails', async () => {
    const { store, current } = setup();
    store.subscribe(() => {});
    store.request(DEFAULT_RECIPE);
    current().runs[0]!.resolve(resultB);
    await flush();

    store.request(caseA);
    current().runs[1]!.reject(new RangeError('time beyond range'));
    await flush();
    const state = store.getSnapshot();
    expect(state.shown?.recipe).toBe(DEFAULT_RECIPE);
    expect(state.pending).toBe(false);
    expect(state.error).toBeInstanceOf(Error);
    expect(state.error?.message).toBe('time beyond range');
  });

  it('clears the error when the next request is sent', async () => {
    const { store, current } = setup();
    store.subscribe(() => {});
    store.request(DEFAULT_RECIPE);
    current().runs[0]!.reject(new Error('boom'));
    await flush();
    expect(store.getSnapshot().error).not.toBeNull();
    store.request(caseA);
    expect(store.getSnapshot().error).toBeNull();
    expect(store.getSnapshot().pending).toBe(true);
  });

  it('tells listeners about each change, and the snapshot object only changes with them', async () => {
    const { store, current } = setup();
    let calls = 0;
    store.subscribe(() => calls++);
    const before = store.getSnapshot();
    expect(store.getSnapshot()).toBe(before);
    store.request(DEFAULT_RECIPE);
    expect(calls).toBeGreaterThan(0);
    expect(store.getSnapshot()).not.toBe(before);
    current().runs[0]!.resolve(resultB);
    await flush();
    const after = store.getSnapshot();
    expect(store.getSnapshot()).toBe(after);
  });

  it('disposes the worker when the last listener leaves, and starts a fresh one for the next', async () => {
    const { store, made } = setup();
    const offFirst = store.subscribe(() => {});
    const offSecond = store.subscribe(() => {});
    expect(made).toHaveLength(1); // two listeners share one worker
    offFirst();
    expect(made[0]!.client.disposed).toBe(false);
    offSecond();
    expect(made[0]!.client.disposed).toBe(true);

    store.request(DEFAULT_RECIPE);
    store.subscribe(() => {});
    expect(made).toHaveLength(2);
    expect(made[1]!.client.disposed).toBe(false);
  });

  it('survives StrictMode: subscribe, unsubscribe, subscribe leaves exactly one live worker, and the work is redone', async () => {
    const { store, made } = setup();
    store.request(DEFAULT_RECIPE);
    const off = store.subscribe(() => {});
    off();
    store.subscribe(() => {});
    expect(made.filter((m) => !m.client.disposed)).toHaveLength(1);
    expect(made[1]!.client.asked).toEqual([DEFAULT_RECIPE]);
    // the answer of the disposed worker's request must not land
    made[0]!.runs[0]!.resolve(resultB);
    await flush();
    expect(store.getSnapshot().shown).toBeNull();
    made[1]!.runs[0]!.resolve(resultB);
    await flush();
    expect(store.getSnapshot().shown?.result).toBe(resultB);
  });
});
