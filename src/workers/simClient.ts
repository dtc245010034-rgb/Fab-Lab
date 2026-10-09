/**
 * The main-thread half of the simulation worker. It numbers requests and answers `null` to any
 * request a newer one has replaced, so the UI keeps showing the previous result until the newest
 * one lands and a late answer can never overwrite a newer picture.
 *
 * It only needs `run` and `bench` from the worker, so tests give it a fake; `createWorkerClient` (spawn.ts)
 * wires it to the real Worker.
 */
import type { Recipe, RecipeResult } from '../sim/recipe';
import type { BenchReport, RunOutcome } from './simService';

export interface SimClient {
  /** The result for `recipe`, or null if a newer `run` (or `dispose`) made this one obsolete. */
  run(recipe: Recipe): Promise<RecipeResult | null>;
  /**
   * Times the recompute on cases A, B, C in the worker (see `SimApi.bench`). Null if the client was
   * disposed meanwhile. Independent of `run`: neither makes the other obsolete.
   */
  bench(runsPerCase: number): Promise<BenchReport | null>;
  /**
   * The worker is gone (failed to load, crashed): the newest request in flight rejects with
   * `error`, and so does every later `run`, because a dead worker would never answer it.
   */
  abort(error: Error): void;
  /** Stops answering and releases the worker. Safe to call twice. */
  dispose(): void;
}

/** What the page relies on in an answer; a failure here is a bug in the worker or the protocol. */
function checkResult(result: RecipeResult): void {
  const { field, section } = result;
  if (typeof field?.maxTimeMin !== 'number' || Number.isNaN(field.maxTimeMin)) {
    throw new Error('worker answered without a usable field.maxTimeMin');
  }
  const cells = section.widthCells * section.heightCells;
  if (!(field.arrival instanceof Float64Array) || field.arrival.length !== cells) {
    throw new Error(
      `worker answered with an unusable field.arrival (${field.arrival?.length} values, grid has ${cells} cells)`,
    );
  }
}

export function createSimClient(
  remote: {
    run(id: number, recipe: Recipe): Promise<RunOutcome>;
    bench(runsPerCase: number): Promise<BenchReport>;
  },
  onDispose: () => void,
): SimClient {
  let latest = 0;
  let disposed = false;
  /** Set once the worker is known to be dead; from then on every run fails at once. */
  let failure: Error | null = null;
  const inFlight = new Map<number | symbol, (error: Error) => void>();

  const rejectInFlight = (error: Error) => {
    for (const reject of [...inFlight.values()]) reject(error);
  };

  return {
    async run(recipe) {
      if (disposed) return null;
      if (failure) throw failure;
      const id = ++latest;
      let outcome: RunOutcome;
      try {
        outcome = await new Promise<RunOutcome>((resolve, reject) => {
          inFlight.set(id, reject);
          remote.run(id, recipe).then(resolve, reject);
        });
      } catch (error) {
        if (id !== latest) return null; // a newer request owns the screen now
        throw error;
      } finally {
        inFlight.delete(id);
      }
      if (outcome.status !== 'ok' || outcome.id !== id || id !== latest) return null;
      checkResult(outcome.result);
      return outcome.result;
    },
    async bench(runsPerCase) {
      if (disposed) return null;
      if (failure) throw failure;
      const key = Symbol('bench');
      try {
        return await new Promise<BenchReport>((resolve, reject) => {
          inFlight.set(key, reject);
          remote.bench(runsPerCase).then(resolve, reject);
        });
      } catch (error) {
        if (disposed) return null;
        throw error;
      } finally {
        inFlight.delete(key);
      }
    },
    abort(error) {
      failure ??= error;
      rejectInFlight(error);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      latest++; // whatever is still in flight is now obsolete and settles as null
      rejectInFlight(new Error('disposed'));
      onDispose();
    },
  };
}
