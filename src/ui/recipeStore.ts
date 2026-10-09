/**
 * Between the simulation worker and React. It holds the last good result *together with the recipe
 * it was computed from* (the header must describe the picture on screen, not the newest request),
 * keeps showing it while the next one is computed, and owns the worker's life: the worker is
 * created when the first listener subscribes and disposed when the last one leaves, so React
 * StrictMode (subscribe, unsubscribe, subscribe) never leaves a stray worker behind.
 *
 * Framework-free on purpose: React reads it through `useSyncExternalStore` (useRecipeResult.ts).
 */
import type { Recipe, RecipeResult } from '../sim/recipe';
import type { SimClient } from '../workers/simClient';

export interface RecipeState {
  /** The last result that arrived and the recipe it belongs to; null before the first one. */
  shown: { recipe: Recipe; result: RecipeResult } | null;
  /** A request is in flight (the previous `shown` stays on screen meanwhile). */
  pending: boolean;
  /** The newest request failed; `shown` still holds the last good result, if any. */
  error: Error | null;
}

export interface RecipeStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): RecipeState;
  /** Ask for this recipe; it is sent when a worker exists (immediately if one already does). */
  request(recipe: Recipe): void;
}

const toError = (value: unknown): Error =>
  value instanceof Error ? value : new Error(String(value));

export function createRecipeStore(createClient: () => SimClient): RecipeStore {
  let state: RecipeState = { shown: null, pending: false, error: null };
  let client: SimClient | null = null;
  let wanted: Recipe | null = null;
  const listeners = new Set<() => void>();

  const update = (next: Partial<RecipeState>) => {
    state = { ...state, ...next };
    listeners.forEach((listener) => listener());
  };

  const send = () => {
    const mine = client;
    const recipe = wanted;
    if (!mine || !recipe) return;
    update({ pending: true, error: null });
    mine.run(recipe).then(
      (result) => {
        // null: a newer request replaced this one, so its answer (not this) will end the wait
        if (result === null || client !== mine) return;
        update({ shown: { recipe, result }, pending: false });
      },
      (error: unknown) => {
        if (client !== mine) return;
        update({ pending: false, error: toError(error) });
      },
    );
  };

  return {
    getSnapshot: () => state,
    request(recipe) {
      wanted = recipe;
      send();
    },
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) {
        client = createClient();
        send();
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && client) {
          client.dispose();
          client = null;
          state = { ...state, pending: false }; // nobody is listening, so no notification
        }
      };
    },
  };
}
