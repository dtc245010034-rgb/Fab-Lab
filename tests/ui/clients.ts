// Test doubles for the simulation worker's client (src/workers/simClient.ts).
import { runRecipe, type Recipe, type RecipeResult } from '../../src/sim/recipe';
import type { SimClient } from '../../src/workers/simClient';

export interface TestClient extends SimClient {
  disposed: boolean;
  /** Every recipe asked for, in order. */
  asked: Recipe[];
}

/** Answers at once with the real `runRecipe` result (no worker in jsdom). */
export function inlineClient(): TestClient {
  const client: TestClient = {
    disposed: false,
    asked: [],
    run: async (recipe) => {
      client.asked.push(recipe);
      return client.disposed ? null : runRecipe(recipe);
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
  const client: TestClient = {
    disposed: false,
    asked: [],
    run: (recipe) =>
      new Promise((resolve, reject) => {
        client.asked.push(recipe);
        runs.push({ recipe, resolve, reject });
      }),
    abort: () => {},
    dispose: () => {
      client.disposed = true;
    },
  };
  return { client, runs };
}
