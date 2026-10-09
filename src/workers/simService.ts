/**
 * What the simulation worker exposes through Comlink (sim.worker.ts only wires it up). It lives in
 * its own file so the rules below can be tested in Node without a real Worker.
 *
 * One request is in flight at a time and at most one waits behind it (the "mailbox"). A request
 * that arrives while another still waits replaces it: the replaced one is answered "superseded"
 * without being computed. A computation itself cannot be interrupted, so the client also drops the
 * answer of a request that was already running when a newer one was made.
 *
 * Before computing, the worker yields once, so messages that were already queued (a slider being
 * dragged) are read first and only the newest of them is computed.
 */
import * as Comlink from 'comlink';
import { runRecipe, type Recipe, type RecipeResult } from '../sim/recipe';

export type RunOutcome =
  { status: 'ok'; id: number; result: RecipeResult } | { status: 'superseded'; id: number };

/** The calls the main thread can make; `Comlink.Remote<SimApi>` is its view of the worker. */
export interface SimApi {
  run(id: number, recipe: Recipe): Promise<RunOutcome>;
}

export interface SimServiceOptions {
  /** Lets queued messages run before the next computation starts. Default: a MessageChannel turn. */
  yieldToEventLoop?: () => Promise<void>;
  /** The computation. Default: `runRecipe`. Replaced in tests to count or capture runs. */
  compute?: (recipe: Recipe) => RecipeResult;
}

/**
 * One turn of the event loop through a MessageChannel. Unlike `setTimeout(0)` it is not clamped to
 * 4 ms when nested, and a message posted earlier by the page is delivered before it.
 */
function yieldViaMessageChannel(): Promise<void> {
  return new Promise((resolve) => {
    const { port1, port2 } = new MessageChannel();
    port1.onmessage = () => {
      port1.close();
      resolve();
    };
    port2.postMessage(null);
  });
}

/**
 * The answer, with `field.arrival` marked for transfer (moved to the page, not copied; 8 bytes per
 * cell). The field is always sent as one `{ arrival, maxTimeMin }` object: `measureEtch` refuses a
 * time beyond `maxTimeMin`, so the page must never hold an arrival array without it.
 *
 * Transferring detaches the whole underlying buffer, so it is only done when `arrival` owns all of
 * it. A view into a larger (pooled) buffer is copied first instead of taking the pool away.
 */
function okOutcome(id: number, result: RecipeResult): RunOutcome {
  const { arrival } = result.field;
  const owned =
    arrival.buffer instanceof ArrayBuffer &&
    arrival.byteOffset === 0 &&
    arrival.byteLength === arrival.buffer.byteLength;
  const sent = owned ? result : { ...result, field: { ...result.field, arrival: arrival.slice() } };
  const outcome: RunOutcome = { status: 'ok', id, result: sent };
  return Comlink.transfer(outcome, [sent.field.arrival.buffer as ArrayBuffer]);
}

interface Job {
  id: number;
  recipe: Recipe;
  resolve: (outcome: RunOutcome) => void;
  reject: (error: unknown) => void;
}

export class SimService implements SimApi {
  private readonly yieldToEventLoop: () => Promise<void>;
  private readonly compute: (recipe: Recipe) => RecipeResult;
  private pending: Job | null = null;
  private draining = false;

  constructor(options: SimServiceOptions = {}) {
    this.yieldToEventLoop = options.yieldToEventLoop ?? yieldViaMessageChannel;
    this.compute = options.compute ?? runRecipe;
  }

  run(id: number, recipe: Recipe): Promise<RunOutcome> {
    return new Promise((resolve, reject) => {
      this.pending?.resolve({ status: 'superseded', id: this.pending.id });
      this.pending = { id, recipe, resolve, reject };
      if (!this.draining) {
        this.draining = true;
        void this.drain();
      }
    });
  }

  /** Takes the newest waiting request after each yield until none is left. Never rejects. */
  private async drain(): Promise<void> {
    try {
      while (this.pending) {
        await this.yieldToEventLoop();
        const job = this.pending;
        if (!job) break;
        this.pending = null;
        try {
          job.resolve(okOutcome(job.id, this.compute(job.recipe)));
        } catch (error) {
          job.reject(error);
        }
      }
    } finally {
      this.draining = false;
    }
  }
}
