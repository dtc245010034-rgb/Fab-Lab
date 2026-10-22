import { useMemo, useState, useSyncExternalStore } from 'react';
import type { M03Client } from '../workers/m03Client';
import { createM03Store, type M03State, type M03Store } from './m03Store';

export interface UseM03 {
  state: M03State;
  setRecipe: M03Store['setRecipe'];
  goToStep: M03Store['goToStep'];
}

const randomSeed = () => Math.floor(Math.random() * 0x7fffffff);

/**
 * The M03 session and what the worker has made of it. `createClient` must be a stable function
 * (declared outside the component): a new one on every render would build a new store, and a new
 * worker, each time. The seed of the exercise is drawn once per mount unless one is given.
 */
export function useM03(createClient: () => M03Client, seed?: number): UseM03 {
  const [fixedSeed] = useState(() => seed ?? randomSeed());
  const store = useMemo(() => createM03Store(createClient, fixedSeed), [createClient, fixedSeed]);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return { state, setRecipe: store.setRecipe, goToStep: store.goToStep };
}
