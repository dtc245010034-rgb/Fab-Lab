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
import { M04_CASES, type M04Case } from '../sim/cases';
import { runRecipe, type Recipe, type RecipeResult } from '../sim/recipe';

export type RunOutcome =
  { status: 'ok'; id: number; result: RecipeResult } | { status: 'superseded'; id: number };

/** Times of one case in a benchmark, one entry per run, in the order they ran. Plain numbers. */
export interface BenchCaseReport {
  id: M04Case['id'];
  /** `timingsMs.total` of each run: litho, grid, rates, arrival time and metrics. */
  totalMs: number[];
  /** `timingsMs.arrival` of each run: the shortest-path search alone. */
  arrivalMs: number[];
}

export interface BenchReport {
  cases: BenchCaseReport[];
}

/** The calls the main thread can make; `Comlink.Remote<SimApi>` is its view of the worker. */
export interface SimApi {
  run(id: number, recipe: Recipe): Promise<RunOutcome>;
  /**
   * Times `runRecipe` on cases A, B, C, `runsPerCase` runs each, after the warm-up has finished.
   * Only the numbers come back; the arrays stay in the worker.
   */
  bench(runsPerCase: number): Promise<BenchReport>;
}

export interface SimServiceOptions {
  /** Lets queued messages run before the next computation starts. Default: a MessageChannel turn. */
  yieldToEventLoop?: () => Promise<void>;
  /** The computation. Default: `runRecipe`. Replaced in tests to count or capture runs. */
  compute?: (recipe: Recipe) => RecipeResult;
  /** Recipes to run, in order and at idle, once `startWarmUp()` is called. Default: none. */
  warmUp?: readonly Recipe[];
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
  private readonly warmUp: readonly Recipe[];
  private pending: Job | null = null;
  private warmQueue: Recipe[] = [];
  /** Warm-up may run once the first real request has been answered (or a benchmark asks for it). */
  private warmReleased = false;
  private pumping = false;
  private finishWarmUp: () => void = () => {};

  /**
   * Settles when the warm-up has run its last recipe (at once if there is nothing to run). `?bench=1`
   * waits for it so that its samples are all steady-state ones.
   */
  readonly warmedUp: Promise<void>;

  constructor(options: SimServiceOptions = {}) {
    this.yieldToEventLoop = options.yieldToEventLoop ?? yieldViaMessageChannel;
    this.compute = options.compute ?? runRecipe;
    this.warmUp = options.warmUp ?? [];
    this.warmedUp = new Promise((resolve) => {
      this.finishWarmUp = resolve;
    });
    if (this.warmUp.length === 0) this.finishWarmUp();
  }

  run(id: number, recipe: Recipe): Promise<RunOutcome> {
    return new Promise((resolve, reject) => {
      this.pending?.resolve({ status: 'superseded', id: this.pending.id });
      this.pending = { id, recipe, resolve, reject };
      this.pump();
    });
  }

  async bench(runsPerCase: number): Promise<BenchReport> {
    if (!Number.isInteger(runsPerCase) || runsPerCase < 1) {
      throw new RangeError(`runsPerCase must be a whole number ≥ 1, got ${runsPerCase}`);
    }
    this.warmReleased = true; // a benchmark is not waiting for a first request
    this.pump();
    await this.warmedUp; // so every sample is a steady-state one
    const cases: BenchCaseReport[] = [];
    for (const { id, recipe } of M04_CASES) {
      const totalMs: number[] = [];
      const arrivalMs: number[] = [];
      for (let run = 0; run < runsPerCase; run++) {
        await this.yieldToEventLoop();
        const { timingsMs } = this.compute(recipe); // same computation as a real request
        totalMs.push(timingsMs.total);
        arrivalMs.push(timingsMs.arrival);
      }
      cases.push({ id, totalMs, arrivalMs });
    }
    return { cases };
  }

  /**
   * Queues the warm-up recipes. They begin after the first real request has been answered, and
   * then run one per turn of the event loop while no real request is waiting. The wait matters:
   * at the worker's first turn the page's first message has not been delivered yet, so a warm-up
   * that started at once would put a cold computation in front of it. A computation cannot be
   * interrupted, so a real request that arrives during one waits for that single run and is
   * served before the next warm-up recipe.
   */
  startWarmUp(): void {
    this.warmQueue = [...this.warmUp];
    this.pump();
  }

  /** Starts the loop below unless it is already running. */
  private pump(): void {
    if (this.pumping) return;
    this.pumping = true;
    void this.work();
  }

  /**
   * One computation per turn of the event loop: the newest real request if there is one, else the
   * next warm-up recipe, else stop. Yielding first is what lets messages that were already queued
   * replace the one that was waiting. Never rejects.
   */
  private async work(): Promise<void> {
    try {
      while (this.pending || (this.warmReleased && this.warmQueue.length > 0)) {
        await this.yieldToEventLoop();
        const job = this.pending;
        if (job) {
          this.pending = null;
          try {
            job.resolve(okOutcome(job.id, this.compute(job.recipe)));
          } catch (error) {
            job.reject(error);
          }
          this.warmReleased = true; // the learner has their first answer; now use the idle time
          continue;
        }
        const recipe = this.warmQueue.shift();
        if (!recipe) continue;
        try {
          this.compute(recipe); // the result is dropped; only the warmed-up code stays
        } catch {
          // Warm-up is best effort. The recipes are the tested cases, so a failure here would
          // already show in their own tests; it must not stop the queue or reach the page.
        }
        if (this.warmQueue.length === 0) this.finishWarmUp();
      }
    } finally {
      this.pumping = false;
    }
  }
}
