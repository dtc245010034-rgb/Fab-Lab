// Test doubles for the simulation worker's client (src/workers/simClient.ts).
import { runRecipe, type Recipe, type RecipeResult } from '../../src/sim/recipe';
import type { SimClient } from '../../src/workers/simClient';
import type { BenchReport } from '../../src/workers/simService';

export interface TestClient extends SimClient {
  disposed: boolean;
  /** Every recipe asked for, in order. */
  asked: Recipe[];
  /** How many times a benchmark was asked for, and with how many runs per case. */
  benched: number[];
}

/** A benchmark report with easy numbers: A is 3–6 and 40 ms, B and C are shifted. */
export const CANNED_BENCH: BenchReport = {
  cases: [
    { id: 'A', totalMs: [3, 4, 5, 6, 40], arrivalMs: [1, 1.5, 2, 2.5, 30] },
    { id: 'B', totalMs: [10, 11, 12, 13, 14], arrivalMs: [8, 8.5, 9, 9.5, 10] },
    { id: 'C', totalMs: [20, 21, 22, 23, 90], arrivalMs: [18, 18.5, 19, 19.5, 70] },
  ],
};

/**
 * What the main thread reports against CANNED_BENCH: case A twice as slow, B twice as fast, C the
 * same, so that each case has a different median ratio (2, 0.5, 1) to check in the table.
 */
export const CANNED_BENCH_MAIN: BenchReport = {
  cases: CANNED_BENCH.cases.map((c, i) => {
    const k = [2, 0.5, 1][i]!;
    return {
      id: c.id,
      totalMs: c.totalMs.map((ms) => ms * k),
      arrivalMs: c.arrivalMs.map((ms) => ms * k),
    };
  }),
};

/** Answers at once with the real `runRecipe` result (no worker in jsdom). */
export function inlineClient(bench: () => Promise<BenchReport | null> = async () => CANNED_BENCH) {
  const client: TestClient = {
    disposed: false,
    asked: [],
    benched: [],
    run: async (recipe) => {
      client.asked.push(recipe);
      return client.disposed ? null : runRecipe(recipe);
    },
    bench: async (runsPerCase) => {
      client.benched.push(runsPerCase);
      return client.disposed ? null : bench();
    },
    abort: () => {},
    dispose: () => {
      client.disposed = true;
    },
  };
  return client;
}

/** Answers only when the test says so, in any order. */
export function manualClient() {
  const runs: {
    recipe: Recipe;
    resolve: (result: RecipeResult | null) => void;
    reject: (error: Error) => void;
  }[] = [];
  const benches: {
    resolve: (report: BenchReport | null) => void;
    reject: (error: Error) => void;
  }[] = [];
  const client: TestClient = {
    disposed: false,
    asked: [],
    benched: [],
    run: (recipe) =>
      new Promise((resolve, reject) => {
        client.asked.push(recipe);
        runs.push({ recipe, resolve, reject });
      }),
    bench: (runsPerCase) =>
      new Promise((resolve, reject) => {
        client.benched.push(runsPerCase);
        benches.push({ resolve, reject });
      }),
    abort: () => {},
    dispose: () => {
      client.disposed = true;
    },
  };
  return { client, runs, benches };
}
