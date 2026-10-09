/**
 * Starts the simulation worker and returns the client for it. This is the only place that names
 * the worker file, and it is kept apart from simClient.ts so that code and tests which only need
 * the client never touch `Worker`. The `new Worker(new URL(...))` form is what Vite looks for to
 * bundle the worker as its own chunk.
 */
import * as Comlink from 'comlink';
import { createSimClient, type SimClient } from './simClient';
import type { SimApi } from './simService';

export function createWorkerClient(): SimClient {
  const worker = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' });
  const remote = Comlink.wrap<SimApi>(worker);
  const client = createSimClient(remote, () => {
    remote[Comlink.releaseProxy]();
    worker.terminate();
  });
  // A script that fails to load or throws raises 'error' and nothing ever answers the pending
  // call; without this the page would wait forever instead of saying it could not compute.
  worker.addEventListener('error', (event) => {
    client.abort(new Error(`simulation worker failed: ${event.message || 'unknown error'}`));
  });
  worker.addEventListener('messageerror', () => {
    client.abort(new Error('simulation worker sent a message that could not be read'));
  });
  return client;
}
