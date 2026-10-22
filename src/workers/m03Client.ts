/**
 * The main-thread half of the M03 requests, next to simClient.ts for M04. It numbers requests and
 * answers `null` to any request that a newer one of the same kind has replaced, so the page keeps
 * showing the previous picture until the newest one lands and a late answer can never overwrite a
 * newer one. A view and a process-window request are independent kinds: asking for one never makes
 * the other obsolete.
 *
 * It only needs `runM03` from the worker, so tests give it a fake; `createM03WorkerClient`
 * (spawn.ts) wires it to the real Worker.
 */
import type { ExposureInput } from '../physics/exposure';
import type { ProcessWindow, ProcessWindowSpec } from '../physics/processWindow';
import type { GridSpec } from '../sim/grid';
import type { M03Request, M03Result, M03Session, M03View } from '../sim/m03';
import type { M03Outcome } from './simService';

export interface M03Client {
  /**
   * The first session for a seed, drawn in the worker (the hidden misplacement of the second mask
   * needs the model, which the page does not carry), or null if a newer `start` replaced it.
   */
  start(seed: number, recipe?: ExposureInput): Promise<M03Session | null>;
  /** The view of `session`, or null if a newer `view` (or `dispose`) made this one obsolete. */
  view(session: M03Session, spec?: GridSpec): Promise<M03View | null>;
  /** The process-window chart of `recipe`, or null if a newer `window` (or `dispose`) replaced it. */
  window(recipe: ExposureInput, spec: ProcessWindowSpec): Promise<ProcessWindow | null>;
  /**
   * The worker is gone (failed to load, crashed): the newest request in flight rejects with
   * `error`, and so does every later request, because a dead worker would never answer it.
   */
  abort(error: Error): void;
  /** Stops answering and releases the worker. Safe to call twice. */
  dispose(): void;
}

/** What the page relies on in an answer; a failure here is a bug in the worker or the protocol. */
function checkStart(result: M03Result): M03Session {
  if (result.kind !== 'start')
    throw new Error(`worker answered a start request with a ${result.kind}`);
  return result.session;
}

function checkView(result: M03Result): M03View {
  if (result.kind !== 'view')
    throw new Error(`worker answered a view request with a ${result.kind}`);
  const { section } = result.view;
  const cells = section.widthCells * section.heightCells;
  if (!(section.materials instanceof Uint8Array) || section.materials.length !== cells) {
    throw new Error(
      `worker answered with an unusable section (${section.materials?.length} values, grid has ${cells} cells)`,
    );
  }
  return result.view;
}

function checkWindow(result: M03Result): ProcessWindow {
  if (result.kind !== 'window') {
    throw new Error(`worker answered a window request with a ${result.kind}`);
  }
  const { window } = result;
  const cells = window.doses.length * window.defocusNm.length;
  if (window.pass.length !== cells || window.cdNm.length !== cells) {
    throw new Error(
      `worker answered with an unusable chart (${window.pass.length} values, ${cells} samples)`,
    );
  }
  return window;
}

export function createM03Client(
  remote: { runM03(id: number, request: M03Request): Promise<M03Outcome> },
  onDispose: () => void,
): M03Client {
  let counter = 0;
  /** The newest request of each kind; an answer to any other is obsolete. */
  const latest = { start: 0, view: 0, window: 0 };
  let disposed = false;
  /** Set once the worker is known to be dead; from then on every request fails at once. */
  let failure: Error | null = null;
  const inFlight = new Map<number, (error: Error) => void>();

  const rejectInFlight = (error: Error) => {
    for (const reject of [...inFlight.values()]) reject(error);
  };

  async function ask(kind: keyof typeof latest, request: M03Request): Promise<M03Result | null> {
    if (disposed) return null;
    if (failure) throw failure;
    const id = ++counter;
    latest[kind] = id;
    let outcome: M03Outcome;
    try {
      outcome = await new Promise<M03Outcome>((resolve, reject) => {
        inFlight.set(id, reject);
        remote.runM03(id, request).then(resolve, reject);
      });
    } catch (error) {
      if (disposed || id !== latest[kind]) return null; // a newer request owns the screen now
      throw error;
    } finally {
      inFlight.delete(id);
    }
    if (outcome.status !== 'ok' || outcome.id !== id || disposed || id !== latest[kind])
      return null;
    return outcome.result;
  }

  return {
    async start(seed, recipe) {
      const result = await ask(
        'start',
        recipe ? { kind: 'start', seed, recipe } : { kind: 'start', seed },
      );
      return result && checkStart(result);
    },
    async view(session, spec) {
      const result = await ask(
        'view',
        spec ? { kind: 'view', session, spec } : { kind: 'view', session },
      );
      return result && checkView(result);
    },
    async window(recipe, spec) {
      const result = await ask('window', { kind: 'window', recipe, spec });
      return result && checkWindow(result);
    },
    abort(error) {
      failure ??= error;
      rejectInFlight(error);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      rejectInFlight(new Error('disposed'));
      onDispose();
    },
  };
}
