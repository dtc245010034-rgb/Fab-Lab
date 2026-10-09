/**
 * The state behind /?bench=1, kept outside React like recipeStore.ts. The worker is created when
 * the first listener subscribes and disposed when the last one leaves (StrictMode safe); the
 * benchmark runs on connect and again on `rerun()` on the same worker. Only the newest run may
 * set the state, so a report that arrives after a newer run has started is ignored.
 */
import type { SimClient } from '../workers/simClient';
import type { BenchReport } from '../workers/simService';

/** Times cases A, B, C on the page's main thread (`?bench=1&thread=main`), `runsPerCase` runs each. */
export type MainBench = (runsPerCase: number) => Promise<BenchReport>;

export type BenchState =
  | { status: 'running' }
  /** `main` is there only when the page asked to time the main thread as well. */
  | { status: 'done'; report: BenchReport; main?: BenchReport }
  | { status: 'error' };

export interface BenchStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): BenchState;
  /** Measure again on the same worker. Does nothing when nobody is listening. */
  rerun(): void;
}

/**
 * `createMainBench` is given only for `?bench=1&thread=main`. It is called when the worker's report
 * is in, never earlier and never for a worker that was disposed, and what it returns is kept for
 * the later runs of this store: the main thread warms up once per page, as the worker does. The two
 * threads are timed one after the other so that they do not compete for the CPU.
 */
export function createBenchStore(
  createClient: () => SimClient,
  runsPerCase: number,
  createMainBench?: () => Promise<MainBench>,
): BenchStore {
  let state: BenchState = { status: 'running' };
  let client: SimClient | null = null;
  let generation = 0;
  let mainBench: Promise<MainBench> | null = null;
  const listeners = new Set<() => void>();

  const set = (next: BenchState) => {
    state = next;
    listeners.forEach((listener) => listener());
  };

  const start = () => {
    const mine = client;
    if (!mine) return;
    const run = ++generation;
    // a run is current until a newer one starts or its worker is disposed (client no longer `mine`)
    const current = () => run === generation && client === mine;
    const runMain = async (create: () => Promise<MainBench>): Promise<BenchReport> => {
      try {
        mainBench ??= create();
        const bench = await mainBench;
        return await bench(runsPerCase);
      } catch (error) {
        mainBench = null; // a failed load (or a failed run) is tried afresh next time
        throw error;
      }
    };
    mine
      .bench(runsPerCase)
      .then(async (report) => {
        // null: the client was disposed meanwhile
        if (!report || !current()) return;
        if (!createMainBench) return set({ status: 'done', report });
        const main = await runMain(createMainBench);
        if (current()) set({ status: 'done', report, main });
      })
      .catch((error: unknown) => {
        if (!current()) return;
        console.error(error);
        set({ status: 'error' });
      });
  };

  return {
    getSnapshot: () => state,
    rerun() {
      if (!client) return;
      set({ status: 'running' });
      start();
    },
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) {
        client = createClient();
        if (state.status !== 'running') set({ status: 'running' });
        start();
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && client) {
          client.dispose();
          client = null;
        }
      };
    },
  };
}
