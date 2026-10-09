import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { Recipe } from '../sim/recipe';
import type { SimClient } from '../workers/simClient';
import { createRecipeStore, type RecipeState } from './recipeStore';

/**
 * The result of `recipe` from the simulation worker. While a newer one is being computed the
 * previous result stays in `shown`. `createClient` must be a stable function (declared outside
 * the component): a new one on every render would build a new store, and a new worker, each time.
 */
export function useRecipeResult(recipe: Recipe, createClient: () => SimClient): RecipeState {
  const store = useMemo(() => createRecipeStore(createClient), [createClient]);
  useEffect(() => {
    store.request(recipe);
  }, [store, recipe]);
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
