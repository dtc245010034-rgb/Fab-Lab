/**
 * The M03 client is the main-thread half for the M03 requests. Like the M04 client it numbers its
 * requests and drops the answer to one that a newer request of the same kind has replaced; a view
 * and a process-window request are independent, since the page asks for them on different
 * triggers and neither makes the other obsolete. The worker is a fake settled by hand.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_M03_RECIPE } from '../../src/sim/defaults';
import {
  createSession,
  deriveView,
  goToStep,
  processWindowSpecFor,
  runM03Request,
  type M03Request,
  type M03Result,
} from '../../src/sim/m03';
import { createM03Client } from '../../src/workers/m03Client';
import type { M03Outcome } from '../../src/workers/simService';

const session = goToStep(createSession(3), 4);
const spec = processWindowSpecFor('i');
const viewResult = runM03Request({ kind: 'view', session });
const windowResult = runM03Request({ kind: 'window', recipe: DEFAULT_M03_RECIPE, spec });

/** A fake worker: every runM03() call waits until the test settles it. */
function fakeRemote() {
  const calls: {
    id: number;
    request: M03Request;
    resolve: (o: M03Outcome) => void;
    reject: (e: unknown) => void;
  }[] = [];
  const remote = {
    runM03: (id: number, request: M03Request) =>
      new Promise<M03Outcome>((resolve, reject) => calls.push({ id, request, resolve, reject })),
  };
  const ok = (id: number, result: M03Result): M03Outcome => ({ status: 'ok', id, result });
  return { remote, calls, ok };
}

describe('createM03Client.view', () => {
  it('asks the worker for the view of the session, on the grid it was given', async () => {
    const { remote, calls, ok } = fakeRemote();
    const client = createM03Client(remote, () => {});
    const grid = { widthCells: 200, heightCells: 150, cellNm: 10, oxideTopRow: 80 };
    const pending = client.view(session, grid);
    expect(calls[0]!.request).toEqual({ kind: 'view', session, spec: grid });
    calls[0]!.resolve(ok(calls[0]!.id, runM03Request({ kind: 'view', session, spec: grid })));
    expect((await pending)!.section.widthCells).toBe(200);
  });

  it('resolves with the view of the only request', async () => {
    const { remote, calls, ok } = fakeRemote();
    const client = createM03Client(remote, () => {});
    const pending = client.view(session);
    calls[0]!.resolve(ok(calls[0]!.id, viewResult));
    expect(await pending).toEqual(deriveView(session));
  });

  it('numbers every request, whatever its kind, so each answer can be matched', () => {
    const { remote, calls } = fakeRemote();
    const client = createM03Client(remote, () => {});
    void client.view(session);
    void client.window(DEFAULT_M03_RECIPE, spec);
    void client.view(session);
    const ids = calls.map((c) => c.id);
    expect(new Set(ids).size).toBe(3);
    expect([...ids].sort((a, b) => a - b)).toEqual(ids);
  });

  it('drops the late answer to a view that a newer view has replaced', async () => {
    const { remote, calls, ok } = fakeRemote();
    const client = createM03Client(remote, () => {});
    const older = client.view(session);
    const newer = client.view(session);
    calls[1]!.resolve(ok(calls[1]!.id, viewResult));
    calls[0]!.resolve(ok(calls[0]!.id, viewResult));
    expect(await newer).not.toBeNull();
    expect(await older).toBeNull();
  });

  it('is null when the worker says the request was superseded', async () => {
    const { remote, calls } = fakeRemote();
    const client = createM03Client(remote, () => {});
    const pending = client.view(session);
    calls[0]!.resolve({ status: 'superseded', id: calls[0]!.id });
    expect(await pending).toBeNull();
  });

  it('passes on a failure of the newest request, and swallows that of an obsolete one', async () => {
    const { remote, calls } = fakeRemote();
    const client = createM03Client(remote, () => {});
    const older = client.view(session);
    const newer = client.view(session);
    const newerFailure = newer.then(
      () => null,
      (e: unknown) => e,
    );
    calls[0]!.reject(new RangeError('old'));
    calls[1]!.reject(new RangeError('boom'));
    expect(await older).toBeNull();
    expect(await newerFailure).toEqual(new RangeError('boom'));
  });

  it('refuses an answer of the wrong kind, or whose grid is not the size it claims', async () => {
    for (const bad of [
      windowResult,
      {
        ...viewResult,
        view: {
          ...deriveView(session),
          section: { ...deriveView(session).section, materials: new Uint8Array(10) },
        },
      } as M03Result,
    ]) {
      const { remote, calls, ok } = fakeRemote();
      const client = createM03Client(remote, () => {});
      const pending = client.view(session);
      calls[0]!.resolve(ok(calls[0]!.id, bad));
      await expect(pending).rejects.toThrow();
    }
  });
});

describe('createM03Client.window', () => {
  it('asks for the chart of the recipe and resolves with it', async () => {
    const { remote, calls, ok } = fakeRemote();
    const client = createM03Client(remote, () => {});
    const pending = client.window(DEFAULT_M03_RECIPE, spec);
    expect(calls[0]!.request).toEqual({ kind: 'window', recipe: DEFAULT_M03_RECIPE, spec });
    calls[0]!.resolve(ok(calls[0]!.id, windowResult));
    const chart = await pending;
    expect(chart!.pass).toHaveLength(25 * 25);
  });

  it('is not made obsolete by a view, nor a view by it', async () => {
    const { remote, calls, ok } = fakeRemote();
    const client = createM03Client(remote, () => {});
    const chart = client.window(DEFAULT_M03_RECIPE, spec);
    const picture = client.view(session);
    calls[1]!.resolve(ok(calls[1]!.id, viewResult));
    calls[0]!.resolve(ok(calls[0]!.id, windowResult));
    expect(await picture).not.toBeNull();
    expect(await chart).not.toBeNull();
  });

  it('drops the late answer to a chart that a newer chart has replaced', async () => {
    const { remote, calls, ok } = fakeRemote();
    const client = createM03Client(remote, () => {});
    const older = client.window(DEFAULT_M03_RECIPE, spec);
    const newer = client.window({ ...DEFAULT_M03_RECIPE, designNm: 600 }, spec);
    calls[1]!.resolve(ok(calls[1]!.id, windowResult));
    calls[0]!.resolve(ok(calls[0]!.id, windowResult));
    expect(await newer).not.toBeNull();
    expect(await older).toBeNull();
  });

  it('refuses an answer of the wrong kind, or whose arrays are not the size of the chart', async () => {
    const short = {
      ...windowResult,
      window: {
        ...(windowResult as Extract<M03Result, { kind: 'window' }>).window,
        pass: new Uint8Array(3),
      },
    } as M03Result;
    for (const bad of [viewResult, short]) {
      const { remote, calls, ok } = fakeRemote();
      const client = createM03Client(remote, () => {});
      const pending = client.window(DEFAULT_M03_RECIPE, spec);
      calls[0]!.resolve(ok(calls[0]!.id, bad));
      await expect(pending).rejects.toThrow();
    }
  });
});

describe('createM03Client.abort and dispose', () => {
  it('abort rejects the newest request in flight and every later one at once', async () => {
    const { remote, calls } = fakeRemote();
    const client = createM03Client(remote, () => {});
    const older = client.view(session);
    const newer = client.view(session);
    const failure = newer.then(
      () => null,
      (e: unknown) => e,
    );
    client.abort(new Error('worker crashed'));
    expect(await older).toBeNull();
    expect(await failure).toEqual(new Error('worker crashed'));
    await expect(client.view(session)).rejects.toThrow('worker crashed');
    await expect(client.window(DEFAULT_M03_RECIPE, spec)).rejects.toThrow('worker crashed');
    expect(calls).toHaveLength(2); // nothing more was sent to a dead worker
  });

  it('dispose settles what is in flight as null, answers null afterwards and releases the worker once', async () => {
    const { remote } = fakeRemote();
    let released = 0;
    const client = createM03Client(remote, () => released++);
    const inFlight = client.view(session);
    const chart = client.window(DEFAULT_M03_RECIPE, spec);
    client.dispose();
    client.dispose();
    expect(await inFlight).toBeNull();
    expect(await chart).toBeNull();
    expect(await client.view(session)).toBeNull();
    expect(await client.window(DEFAULT_M03_RECIPE, spec)).toBeNull();
    expect(released).toBe(1);
  });
});
