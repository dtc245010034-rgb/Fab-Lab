/**
 * The state behind /?bench=1, kept outside React like recipeStore.ts. The worker is created when
 * the first listener subscribes and disposed when the last one leaves (StrictMode safe); the
 * benchmark runs on connect and again on `rerun()` on the same worker. Only the newest run may
 * set the state, so a report that arrives after a newer run has started is ignored.
 */
import type { SimClient } from '../workers/simClient';
import type { BenchReport } from '../workers/simService';

export type BenchState =
  { status: 'running' } | { status: 'done'; report: BenchReport } | { status: 'error' };

export interface BenchStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): BenchState;
  /** Measure again on the same worker. Does nothing when nobody is listening. */
  rerun(): void;
}

export function createBenchStore(createClient: () => SimClient, runsPerCase: number): BenchStore {
  let state: BenchState = { status: 'running' };
  let client: SimClient | null = null;
  let generation = 0;
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
    mine.bench(runsPerCase).then(
      (report) => {
        // null: the client was disposed meanwhile
        if (report && current()) set({ status: 'done', report });
      },
      (error: unknown) => {
        if (!current()) return;
        console.error(error);
        set({ status: 'error' });
      },
    );
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
