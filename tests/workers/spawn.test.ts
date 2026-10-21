/**
 * spawn.ts is the only place that names the worker file. Here `Worker` is an in-process fake wired
 * to a real SimService over a MessageChannel, so the two factories (M04's and M03's) are checked
 * end to end without a browser: what they start, how the page's calls travel, what a failed
 * worker does, and that disposing releases it. The real Worker is exercised by the e2e tests.
 */
import * as Comlink from 'comlink';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_RECIPE } from '../../src/sim/defaults';
import { createSession, deriveView, goToStep } from '../../src/sim/m03';
import { runRecipe } from '../../src/sim/recipe';
import { SimService } from '../../src/workers/simService';
import { createM03WorkerClient, createWorkerClient } from '../../src/workers/spawn';

type Listener = (event: unknown) => void;

class FakeWorker {
  static instances: FakeWorker[] = [];
  terminated = 0;
  private readonly page: MessagePort;
  private readonly inside: MessagePort;
  private readonly local = new Map<string, Set<Listener>>();

  readonly url: URL;
  readonly options: WorkerOptions | undefined;

  constructor(url: URL, options: WorkerOptions | undefined) {
    this.url = url;
    this.options = options;
    const { port1, port2 } = new MessageChannel();
    this.page = port1;
    this.inside = port2;
    Comlink.expose(new SimService(), port2 as unknown as Comlink.Endpoint);
    FakeWorker.instances.push(this);
  }

  addEventListener(type: string, listener: Listener) {
    if (type === 'message') this.page.addEventListener('message', listener as EventListener);
    else this.local.set(type, (this.local.get(type) ?? new Set()).add(listener));
  }
  removeEventListener(type: string, listener: Listener) {
    if (type === 'message') this.page.removeEventListener('message', listener as EventListener);
    else this.local.get(type)?.delete(listener);
  }
  start() {
    this.page.start();
  }
  postMessage(message: unknown, transfer?: Transferable[]) {
    this.page.postMessage(message, transfer ?? []);
  }
  terminate() {
    this.terminated++;
    this.page.close();
    this.inside.close();
  }
  /** The browser telling the page the worker failed. */
  emit(type: string, event: unknown) {
    this.local.get(type)?.forEach((listener) => listener(event));
  }
}

beforeEach(() => {
  FakeWorker.instances = [];
  vi.stubGlobal('Worker', FakeWorker);
});
afterEach(() => {
  FakeWorker.instances.forEach((w) => w.terminated === 0 && w.terminate());
  vi.unstubAllGlobals();
});

describe('createWorkerClient (M04)', () => {
  it('starts one module worker from sim.worker.ts', () => {
    const client = createWorkerClient();
    expect(FakeWorker.instances).toHaveLength(1);
    expect(FakeWorker.instances[0]!.url.pathname).toMatch(/\/workers\/sim\.worker\.ts$/);
    expect(FakeWorker.instances[0]!.options).toEqual({ type: 'module' });
    client.dispose();
  });

  it('runs a recipe in the worker and brings the same result back', async () => {
    const client = createWorkerClient();
    const result = await client.run(DEFAULT_RECIPE);
    expect(result!.metrics).toEqual(runRecipe(DEFAULT_RECIPE).metrics);
    client.dispose();
  });

  it('terminates the worker once, however often it is disposed', () => {
    const client = createWorkerClient();
    client.dispose();
    client.dispose();
    expect(FakeWorker.instances[0]!.terminated).toBe(1);
  });

  it('turns a worker that fails to load into an error for every request', async () => {
    const client = createWorkerClient();
    FakeWorker.instances[0]!.emit('error', { message: 'script not found' });
    await expect(client.run(DEFAULT_RECIPE)).rejects.toThrow(
      'simulation worker failed: script not found',
    );
    client.dispose();
  });
});

describe('createM03WorkerClient', () => {
  it('starts one module worker from the same file', () => {
    const client = createM03WorkerClient();
    expect(FakeWorker.instances).toHaveLength(1);
    expect(FakeWorker.instances[0]!.url.pathname).toMatch(/\/workers\/sim\.worker\.ts$/);
    expect(FakeWorker.instances[0]!.options).toEqual({ type: 'module' });
    client.dispose();
  });

  it('computes the view of a session in the worker', async () => {
    const client = createM03WorkerClient();
    const session = goToStep(createSession(2), 4);
    const view = await client.view(session);
    expect(view).toEqual(deriveView(session));
    client.dispose();
  });

  it('computes the process window of a recipe in the worker', async () => {
    const client = createM03WorkerClient();
    const session = createSession(2);
    const { processWindowSpecFor } = await import('../../src/sim/m03');
    const chart = await client.window(session.recipe, processWindowSpecFor('i'));
    expect(chart!.pass).toHaveLength(25 * 25);
    client.dispose();
  });

  it('terminates the worker once, however often it is disposed', () => {
    const client = createM03WorkerClient();
    client.dispose();
    client.dispose();
    expect(FakeWorker.instances[0]!.terminated).toBe(1);
  });

  it('turns a worker that fails to load, or sends garbage, into an error for every request', async () => {
    const failing = createM03WorkerClient();
    FakeWorker.instances[0]!.emit('error', { message: 'script not found' });
    await expect(failing.view(createSession(1))).rejects.toThrow(
      'simulation worker failed: script not found',
    );
    const garbled = createM03WorkerClient();
    FakeWorker.instances[1]!.emit('messageerror', {});
    await expect(garbled.view(createSession(1))).rejects.toThrow(/could not be read/);
    failing.dispose();
    garbled.dispose();
  });
});
