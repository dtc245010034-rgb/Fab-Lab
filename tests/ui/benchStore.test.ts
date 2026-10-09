/**
 * The store behind /?bench=1: it owns the worker for as long as somebody listens, runs the
 * benchmark when it connects and again on request, and only the newest run may set the state.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBenchStore } from '../../src/ui/benchStore';
import { CANNED_BENCH, manualClient, type TestClient } from './clients';

afterEach(() => {
  vi.restoreAllMocks();
});

function setup() {
  const made: ReturnType<typeof manualClient>[] = [];
  const store = createBenchStore(() => {
    const m = manualClient();
    made.push(m);
    return m.client as TestClient;
  }, 7);
  return { store, made, current: () => made.at(-1)! };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createBenchStore', () => {
  it('starts running, and creates no worker until somebody listens', () => {
    const { store, made } = setup();
    expect(store.getSnapshot()).toEqual({ status: 'running' });
    expect(made).toHaveLength(0);
  });

  it('asks the worker for the number of runs per case it was given', () => {
    const { store, current } = setup();
    store.subscribe(() => {});
    expect(current().client.benched).toEqual([7]);
  });

  it('is done when the report arrives', async () => {
    const { store, current } = setup();
    store.subscribe(() => {});
    current().benches[0]!.resolve(CANNED_BENCH);
    await flush();
    expect(store.getSnapshot()).toEqual({ status: 'done', report: CANNED_BENCH });
  });

  it('reports an error, and logs why', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { store, current } = setup();
    store.subscribe(() => {});
    const boom = new Error('worker failed to start');
    current().benches[0]!.reject(boom);
    await flush();
    expect(store.getSnapshot()).toEqual({ status: 'error' });
    expect(log).toHaveBeenCalledWith(boom);
  });

  it('measures again on the same worker when asked, and shows "running" meanwhile', async () => {
    const { store, made, current } = setup();
    store.subscribe(() => {});
    current().benches[0]!.resolve(CANNED_BENCH);
    await flush();

    store.rerun();
    expect(store.getSnapshot()).toEqual({ status: 'running' });
    expect(made).toHaveLength(1);
    expect(current().client.benched).toEqual([7, 7]);
    current().benches[1]!.resolve(CANNED_BENCH);
    await flush();
    expect(store.getSnapshot().status).toBe('done');
  });

  it('lets only the newest run set the state: a late report of an older run is ignored', async () => {
    const { store, current } = setup();
    store.subscribe(() => {});
    store.rerun(); // a second run starts before the first has answered
    current().benches[1]!.resolve(CANNED_BENCH);
    await flush();
    expect(store.getSnapshot().status).toBe('done');
    const newer = store.getSnapshot();
    current().benches[0]!.reject(new Error('too late')); // the older run fails afterwards
    await flush();
    expect(store.getSnapshot()).toBe(newer);
  });

  it('ignores a null report (the client was disposed)', async () => {
    const { store, current } = setup();
    store.subscribe(() => {});
    current().benches[0]!.resolve(null);
    await flush();
    expect(store.getSnapshot()).toEqual({ status: 'running' });
  });

  it('does nothing when asked to rerun with nobody listening', () => {
    const { store, made } = setup();
    store.rerun();
    expect(made).toHaveLength(0);
    expect(store.getSnapshot()).toEqual({ status: 'running' });
  });

  it('survives StrictMode: one live worker, and the disposed worker cannot set the state', async () => {
    const { store, made } = setup();
    const off = store.subscribe(() => {});
    off();
    store.subscribe(() => {});
    expect(made.filter((m) => !m.client.disposed)).toHaveLength(1);
    made[0]!.benches[0]!.resolve(CANNED_BENCH); // the first worker answers after it was disposed
    await flush();
    expect(store.getSnapshot()).toEqual({ status: 'running' });
    made[1]!.benches[0]!.resolve(CANNED_BENCH);
    await flush();
    expect(store.getSnapshot().status).toBe('done');
  });

  it('disposes the worker when the last listener leaves', () => {
    const { store, made } = setup();
    const a = store.subscribe(() => {});
    const b = store.subscribe(() => {});
    a();
    expect(made[0]!.client.disposed).toBe(false);
    b();
    expect(made[0]!.client.disposed).toBe(true);
  });
});
