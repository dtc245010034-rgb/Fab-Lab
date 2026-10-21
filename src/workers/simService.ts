/**
 * What the simulation worker exposes through Comlink (sim.worker.ts only wires it up). It lives in
 * its own file so the rules below can be tested in Node without a real Worker.
 *
 * Requests come in kinds: an M04 recipe, an M03 view, an M03 process window. One request is in
 * flight at a time, and each kind has at most one waiting behind it (its "mailbox"). A request that
 * arrives while another of the same kind still waits replaces it: the replaced one is answered
 * "superseded" without being computed. Requests of different kinds never replace each other; they
 * are computed in the order they arrived. A computation itself cannot be interrupted, so the client
 * also drops the answer of a request that was already running when a newer one was made.
 *
 * Before computing, the worker yields once, so messages that were already queued (a slider being
 * dragged) are read first and only the newest of them is computed.
 */
import * as Comlink from 'comlink';
import { M04_CASES, type M04Case } from '../sim/cases';
import { DEFAULT_M03_RECIPE, M03_BENCH_WARMUP_RUNS } from '../sim/defaults';
import { processWindowSpecFor, runM03Request, type M03Request, type M03Result } from '../sim/m03';
import { runRecipe, type Recipe, type RecipeResult } from '../sim/recipe';

export type RunOutcome =
  { status: 'ok'; id: number; result: RecipeResult } | { status: 'superseded'; id: number };

/** The answer to an M03 request. The result is copied to the page, not transferred (it is small). */
export type M03Outcome =
  { status: 'ok'; id: number; result: M03Result } | { status: 'superseded'; id: number };

/** Times of one case in a benchmark, one entry per run, in the order they ran. Plain numbers. */
export interface BenchCaseReport {
  id: M04Case['id'];
  /** `timingsMs.total` of each run: litho, grid, rates, arrival time and metrics. */
  totalMs: number[];
  /** `timingsMs.arrival` of each run: the shortest-path search alone. */
  arrivalMs: number[];
}

/** Times of the M03 process-window chart, one entry per run, in the order they ran. */
export interface WindowBenchReport {
  doseSteps: number;
  defocusSteps: number;
  /** `timingsMs.total` of each run: every sample of the chart. */
  totalMs: number[];
}

export interface BenchReport {
  cases: BenchCaseReport[];
  /** Absent in reports from before M03; present in every report the worker makes now. */
  processWindow?: WindowBenchReport;
}

/** The calls the main thread can make; `Comlink.Remote<SimApi>` is its view of the worker. */
export interface SimApi {
  run(id: number, recipe: Recipe): Promise<RunOutcome>;
  runM03(id: number, request: M03Request): Promise<M03Outcome>;
  /**
   * Times `runRecipe` on cases A, B, C, `runsPerCase` runs each, after the warm-up has finished,
   * then the M03 process-window chart the same number of times. Only the numbers come back; the
   * arrays stay in the worker.
   */
  bench(runsPerCase: number): Promise<BenchReport>;
}

export interface SimServiceOptions {
  /** Lets queued messages run before the next computation starts. Default: a MessageChannel turn. */
  yieldToEventLoop?: () => Promise<void>;
  /** The computation. Default: `runRecipe`. Replaced in tests to count or capture runs. */
  compute?: (recipe: Recipe) => RecipeResult;
  /** The M03 computation. Default: `runM03Request`. Replaced in tests like `compute`. */
  computeM03?: (request: M03Request) => M03Result;
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

interface EtchJob {
  kind: 'etch';
  id: number;
  recipe: Recipe;
  resolve: (outcome: RunOutcome) => void;
  reject: (error: unknown) => void;
}

interface M03Job {
  kind: 'm03';
  id: number;
  request: M03Request;
  resolve: (outcome: M03Outcome) => void;
  reject: (error: unknown) => void;
}

type Job = EtchJob | M03Job;

/** Jobs with the same mailbox replace each other. */
const mailbox = (job: Job) => (job.kind === 'etch' ? 'etch' : `m03:${job.request.kind}`);

export class SimService implements SimApi {
  private readonly yieldToEventLoop: () => Promise<void>;
  private readonly compute: (recipe: Recipe) => RecipeResult;
  private readonly computeM03: (request: M03Request) => M03Result;
  private readonly warmUp: readonly Recipe[];
  /** The jobs that wait, oldest first, at most one per mailbox. */
  private queue: Job[] = [];
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
    this.computeM03 = options.computeM03 ?? runM03Request;
    this.warmUp = options.warmUp ?? [];
    this.warmedUp = new Promise((resolve) => {
      this.finishWarmUp = resolve;
    });
    if (this.warmUp.length === 0) this.finishWarmUp();
  }

  run(id: number, recipe: Recipe): Promise<RunOutcome> {
    return new Promise((resolve, reject) => {
      this.enqueue({ kind: 'etch', id, recipe, resolve, reject });
    });
  }

  runM03(id: number, request: M03Request): Promise<M03Outcome> {
    return new Promise((resolve, reject) => {
      this.enqueue({ kind: 'm03', id, request, resolve, reject });
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
    return { cases, processWindow: await this.benchProcessWindow(runsPerCase) };
  }

  /** The M03 chart on its default condition: a few runs left out, then `runs` timed ones. */
  private async benchProcessWindow(runs: number): Promise<WindowBenchReport> {
    const spec = processWindowSpecFor(DEFAULT_M03_RECIPE.source);
    const request: M03Request = { kind: 'window', recipe: DEFAULT_M03_RECIPE, spec };
    for (let warm = 0; warm < M03_BENCH_WARMUP_RUNS; warm++) {
      await this.yieldToEventLoop();
      this.computeM03(request);
    }
    const totalMs: number[] = [];
    for (let run = 0; run < runs; run++) {
      await this.yieldToEventLoop();
      totalMs.push(this.computeM03(request).timingsMs.total); // same computation as a real request
    }
    return { doseSteps: spec.doseSteps, defocusSteps: spec.defocusSteps, totalMs };
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

  /** Puts the job in its mailbox, replacing (and answering "superseded") the one waiting there. */
  private enqueue(job: Job): void {
    const waiting = this.queue.findIndex((other) => mailbox(other) === mailbox(job));
    if (waiting >= 0) {
      const [replaced] = this.queue.splice(waiting, 1);
      replaced!.resolve({ status: 'superseded', id: replaced!.id });
    }
    this.queue.push(job);
    this.pump();
  }

  /** Starts the loop below unless it is already running. */
  private pump(): void {
    if (this.pumping) return;
    this.pumping = true;
    void this.work();
  }

  /** Computes a job and answers it; a failure goes to the caller of that job only. */
  private execute(job: Job): void {
    try {
      if (job.kind === 'etch') job.resolve(okOutcome(job.id, this.compute(job.recipe)));
      else job.resolve({ status: 'ok', id: job.id, result: this.computeM03(job.request) });
    } catch (error) {
      job.reject(error);
    }
  }

  /**
   * One computation per turn of the event loop: the oldest waiting request if there is one, else
   * the next warm-up recipe, else stop. Yielding first is what lets messages that were already
   * queued replace the ones that were waiting. Never rejects.
   */
  private async work(): Promise<void> {
    try {
      while (this.queue.length > 0 || (this.warmReleased && this.warmQueue.length > 0)) {
        await this.yieldToEventLoop();
        const job = this.queue.shift();
        if (job) {
          this.execute(job);
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
