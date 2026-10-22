import { describe, expect, it } from 'vitest';
import { DEFAULT_M03_RECIPE } from '../../src/sim/defaults';
import { createSession, runM03Request } from '../../src/sim/m03';
import { createM03Client } from '../../src/workers/m03Client';
import { SimService } from '../../src/workers/simService';

const immediate = () => new SimService({ yieldToEventLoop: async () => {} });

describe('the start request: the worker draws the session, the page does not carry the model', () => {
  it('answers with createSession(seed)', () => {
    const result = runM03Request({ kind: 'start', seed: 42 });
    expect(result.kind).toBe('start');
    if (result.kind !== 'start') return;
    expect(result.session).toEqual(createSession(42));
    expect(result.timingsMs.total).toBeGreaterThanOrEqual(0);
  });

  it('takes the recipe it is given', () => {
    const recipe = { ...DEFAULT_M03_RECIPE, dose: 1.1 };
    const result = runM03Request({ kind: 'start', seed: 5, recipe });
    expect(result.kind === 'start' && result.session.recipe).toEqual(recipe);
  });

  it('goes through the client and a real service; different seeds give different sessions', async () => {
    const client = createM03Client(immediate(), () => {});
    const a = await client.start(1);
    const b = await client.start(2);
    expect(a).toEqual(createSession(1));
    expect(b).toEqual(createSession(2));
    expect(a!.hidden).not.toEqual(b!.hidden);
  });

  it('is its own kind: a view asked for beside it does not make it obsolete, nor the reverse', async () => {
    const client = createM03Client(immediate(), () => {});
    const [session, view] = await Promise.all([client.start(7), client.view(createSession(7))]);
    expect(session).toEqual(createSession(7));
    expect(view).not.toBeNull();
  });

  it('a newer start replaces the older one: the older resolves null', async () => {
    const service = new SimService({
      yieldToEventLoop: () => new Promise((resolve) => setTimeout(resolve, 5)),
    });
    const client = createM03Client(service, () => {});
    const older = client.start(1);
    const newer = client.start(2);
    expect(await older).toBeNull();
    expect(await newer).toEqual(createSession(2));
  });

  it('refuses an answer of the wrong kind', async () => {
    const client = createM03Client(
      {
        runM03: async (id) => ({
          status: 'ok' as const,
          id,
          result: { kind: 'window' as const, window: {} as never, timingsMs: { total: 0 } },
        }),
      },
      () => {},
    );
    await expect(client.start(1)).rejects.toThrow(/start/);
  });
});
