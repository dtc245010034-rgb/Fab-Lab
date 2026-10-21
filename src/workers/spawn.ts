/**
 * Starts the simulation worker and returns the client for it. This is the only place that names
 * the worker file, and it is kept apart from simClient.ts and m03Client.ts so that code and tests
 * which only need a client never touch `Worker`. The `new Worker(new URL(...))` form is what Vite
 * looks for to bundle the worker as its own chunk.
 *
 * One worker serves M04 (`createWorkerClient`) or M03 (`createM03WorkerClient`); a page uses one
 * of them, so each client starts its own.
 */
import * as Comlink from 'comlink';
import { createM03Client, type M03Client } from './m03Client';
import { createSimClient, type SimClient } from './simClient';
import type { SimApi } from './simService';

/** A worker with its Comlink view, and what to call when it fails or sends something unreadable. */
function startWorker(onFailure: (error: Error) => void) {
  const worker = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' });
  const remote = Comlink.wrap<SimApi>(worker);
  // A script that fails to load or throws raises 'error' and nothing ever answers the pending
  // call; without this the page would wait forever instead of saying it could not compute.
  worker.addEventListener('error', (event) => {
    onFailure(new Error(`simulation worker failed: ${event.message || 'unknown error'}`));
  });
  worker.addEventListener('messageerror', () => {
    onFailure(new Error('simulation worker sent a message that could not be read'));
  });
  const release = () => {
    remote[Comlink.releaseProxy]();
    worker.terminate();
  };
  return { remote, release };
}

export function createWorkerClient(): SimClient {
  let client: SimClient | null = null;
  const { remote, release } = startWorker((error) => client?.abort(error));
  client = createSimClient(remote, release);
  return client;
}

export function createM03WorkerClient(): M03Client {
  let client: M03Client | null = null;
  const { remote, release } = startWorker((error) => client?.abort(error));
  client = createM03Client(remote, release);
  return client;
}
