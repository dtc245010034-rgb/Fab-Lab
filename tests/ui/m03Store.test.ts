/**
 * The store between the M03 worker and React: the session lives here, every change shows at once,
 * the previous picture stays until the new one lands, the chart is asked for only when it is on
 * screen and something it depends on has changed, and the worker lives as long as someone listens.
 */
import { describe, expect, it, vi } from 'vitest';
import { createSession, M03_STEPS } from '../../src/sim/m03';
import { createM03Store } from '../../src/ui/m03Store';
import { inlineM03Client, manualM03Client } from './m03Clients';

const EXPOSE = M03_STEPS.indexOf('expose');
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A store whose listener is attached, as a mounted page would. */
function mounted(client: ReturnType<typeof inlineM03Client>, seed = 11) {
  const store = createM03Store(() => client, seed);
  const unsubscribe = store.subscribe(() => {});
  return { store, unsubscribe };
}

describe('the first session', () => {
  it('is asked of the worker with the seed, and is the session the model draws for it', async () => {
    const { client, answerStart } = manualM03Client();
    const store = createM03Store(() => client, 123);
    store.subscribe(() => {});
    expect(client.starts).toEqual([123]);
    expect(store.getSnapshot().session).toBeNull();
    expect(store.getSnapshot().shown).toBeNull();
    answerStart();
    await flush();
    expect(store.getSnapshot().session).toEqual(createSession(123));
  });

  it('applies what the learner did before it arrived, in order', async () => {
    const m = manualM03Client();
    const store = createM03Store(() => m.client, 5);
    store.subscribe(() => {});
    store.setRecipe({ dose: 1.1 });
    store.goToStep(2);
    store.setRecipe({ developMin: 1.2 });
    m.answerStart();
    await flush();
    const { session } = store.getSnapshot();
    expect(session!.recipe.dose).toBe(1.1);
    expect(session!.recipe.developMin).toBe(1.2);
    expect(session!.step).toBe(2);
    expect(m.client.views.at(-1)).toEqual(session);
  });

  it('asks for the first view once the session is there, and shows it with the session it came from', async () => {
    const { store } = mounted(inlineM03Client());
    await flush();
    const { shown, pending, error } = store.getSnapshot();
    expect(shown!.view.step).toBe(0);
    expect(shown!.session).toBe(store.getSnapshot().session);
    expect(pending).toBe(false);
    expect(error).toBeNull();
  });
});

describe('a change', () => {
  it('shows in the session at once; the picture on screen stays until the new one lands', async () => {
    const m = manualM03Client();
    const store = createM03Store(() => m.client, 1);
    store.subscribe(() => {});
    m.answerStart();
    await flush();
    m.answerView(0);
    await flush();
    const first = store.getSnapshot().shown!;

    store.setRecipe({ dose: 1.2 });
    const during = store.getSnapshot();
    expect(during.session!.recipe.dose).toBe(1.2); // the control moves now
    expect(during.shown).toBe(first); // the picture does not
    expect(during.pending).toBe(true);

    m.answerView(1);
    await flush();
    const after = store.getSnapshot();
    expect(after.shown!.session.recipe.dose).toBe(1.2);
    expect(after.shown!.view.exposure.dose).toBe(1.2);
    expect(after.pending).toBe(false);
  });

  it('stays pending when its request is replaced by a newer one (null) and is answered by that one', async () => {
    const m = manualM03Client();
    const store = createM03Store(() => m.client, 1);
    store.subscribe(() => {});
    m.answerStart();
    await flush();
    store.setRecipe({ dose: 1.1 });
    m.views[0]!.resolve(null); // superseded
    await flush();
    expect(store.getSnapshot().pending).toBe(true);
    m.answerView(1);
    await flush();
    expect(store.getSnapshot().pending).toBe(false);
    expect(store.getSnapshot().shown!.view.exposure.dose).toBe(1.1);
  });

  it('follows the step: the view shows the stage of the step chosen', async () => {
    const { store } = mounted(inlineM03Client());
    await flush();
    store.goToStep(4);
    await flush();
    expect(store.getSnapshot().shown!.view.stage).toBe('developed');
    store.goToStep(1);
    await flush();
    expect(store.getSnapshot().shown!.view.stage).toBe('resist');
  });

  it('refuses a step that does not exist', async () => {
    const { store } = mounted(inlineM03Client());
    await flush();
    expect(() => store.goToStep(9)).toThrow(RangeError);
  });

  it('keeps the last good picture and reports the error when a request fails', async () => {
    const m = manualM03Client();
    const store = createM03Store(() => m.client, 1);
    store.subscribe(() => {});
    m.answerStart();
    await flush();
    m.answerView(0);
    await flush();
    const good = store.getSnapshot().shown;
    store.setRecipe({ dose: 1.3 });
    m.views[1]!.reject(new Error('worker died'));
    await flush();
    const s = store.getSnapshot();
    expect(s.error?.message).toBe('worker died');
    expect(s.shown).toBe(good);
    expect(s.pending).toBe(false);
  });
});

describe('the process-window chart', () => {
  it('is not asked for away from the exposure step', async () => {
    const client = inlineM03Client();
    const { store } = mounted(client);
    await flush();
    store.setRecipe({ designNm: 900 });
    store.goToStep(2);
    await flush();
    expect(client.windows).toHaveLength(0);
    expect(store.getSnapshot().chart).toBeNull();
  });

  it('is asked for on arriving at the exposure step, once, for the source chosen', async () => {
    const client = inlineM03Client();
    const { store } = mounted(client);
    await flush();
    store.setRecipe({ source: 'krf' });
    store.goToStep(EXPOSE);
    await flush();
    expect(client.windows).toHaveLength(1);
    expect(client.windows[0]!.recipe.source).toBe('krf');
    expect(client.windows[0]!.spec.doseSteps).toBe(25);
    const { chart, session } = store.getSnapshot();
    expect(chart!.window.pass).toHaveLength(25 * 25);
    expect(chart!.recipe.source).toBe('krf');
    expect(chart!.recipe).toEqual(session!.recipe);
  });

  it('is not asked for again when only the dose or the focus move: the chart sweeps those itself', async () => {
    const client = inlineM03Client();
    const { store } = mounted(client);
    await flush();
    store.goToStep(EXPOSE);
    await flush();
    store.setRecipe({ dose: 1.2 });
    store.setRecipe({ defocusNm: 100 });
    store.setRecipe({ dose: 0.9, defocusNm: -100 });
    await flush();
    expect(client.windows).toHaveLength(1);
  });

  it.each([
    ['designNm', { designNm: 700 }],
    ['source', { source: 'arf' as const }],
    ['polarity', { polarity: 'negative' as const }],
    ['spinRpm', { spinRpm: 4000 }],
    ['developMin', { developMin: 1.3 }],
    ['softBake', { softBake: { tempC: 100, timeMin: 1 } }],
  ])('is asked for again when the %s changes', async (_name, patch) => {
    const client = inlineM03Client();
    const { store } = mounted(client);
    await flush();
    store.goToStep(EXPOSE);
    await flush();
    store.setRecipe(patch);
    await flush();
    expect(client.windows).toHaveLength(2);
  });

  it('is asked for again after leaving and coming back only if something it depends on changed', async () => {
    const client = inlineM03Client();
    const { store } = mounted(client);
    await flush();
    store.goToStep(EXPOSE);
    await flush();
    store.goToStep(1);
    store.setRecipe({ spinRpm: 2500 });
    store.goToStep(EXPOSE);
    await flush();
    expect(client.windows).toHaveLength(2);
    store.goToStep(4);
    store.goToStep(EXPOSE);
    await flush();
    expect(client.windows).toHaveLength(2);
  });

  it('keeps the previous chart on screen while the next is computed', async () => {
    const m = manualM03Client();
    const store = createM03Store(() => m.client, 1);
    store.subscribe(() => {});
    m.answerStart();
    await flush();
    store.goToStep(EXPOSE);
    m.windows[0]!.resolve({
      doses: new Float64Array(0),
      defocusNm: new Float64Array(0),
      cdNm: new Float64Array(0),
      pass: new Uint8Array(0),
      passCount: 0,
    });
    await flush();
    const first = store.getSnapshot().chart;
    expect(first).not.toBeNull();
    store.setRecipe({ designNm: 600 });
    expect(store.getSnapshot().chart).toBe(first);
    expect(store.getSnapshot().chartPending).toBe(true);
  });
});

describe('the worker', () => {
  it('is created when the first listener subscribes and released when the last leaves', () => {
    const create = vi.fn(() => inlineM03Client());
    const store = createM03Store(create, 1);
    expect(create).not.toHaveBeenCalled();
    const a = store.subscribe(() => {});
    const b = store.subscribe(() => {});
    expect(create).toHaveBeenCalledTimes(1);
    const client = create.mock.results[0]!.value as ReturnType<typeof inlineM03Client>;
    a();
    expect(client.disposed).toBe(false);
    b();
    expect(client.disposed).toBe(true);
  });

  it('survives subscribe, unsubscribe, subscribe (React StrictMode): one live worker, the session kept, not drawn twice', async () => {
    const clients: ReturnType<typeof inlineM03Client>[] = [];
    const store = createM03Store(() => {
      const c = inlineM03Client();
      clients.push(c);
      return c;
    }, 3);
    const first = store.subscribe(() => {});
    first();
    store.subscribe(() => {});
    await flush();
    expect(clients).toHaveLength(2);
    expect(clients[0]!.disposed).toBe(true);
    expect(clients[1]!.disposed).toBe(false);
    expect(store.getSnapshot().shown).not.toBeNull();
    expect(store.getSnapshot().session).toEqual(createSession(3));
  });

  it('does not start again, and does not lose a change, when it is subscribed again after the session exists', async () => {
    const clients: ReturnType<typeof inlineM03Client>[] = [];
    const store = createM03Store(() => {
      const c = inlineM03Client();
      clients.push(c);
      return c;
    }, 3);
    const off = store.subscribe(() => {});
    await flush();
    store.setRecipe({ dose: 1.2 });
    off();
    store.subscribe(() => {});
    await flush();
    expect(clients[1]!.starts).toEqual([]);
    expect(store.getSnapshot().session!.recipe.dose).toBe(1.2);
    expect(store.getSnapshot().shown!.view.exposure.dose).toBe(1.2);
  });

  it('tells its listeners about every change', async () => {
    const store = createM03Store(() => inlineM03Client(), 1);
    const listener = vi.fn();
    store.subscribe(listener);
    await flush();
    const calls = listener.mock.calls.length;
    expect(calls).toBeGreaterThan(0);
    store.setRecipe({ dose: 1.1 });
    expect(listener.mock.calls.length).toBeGreaterThan(calls);
  });
});
