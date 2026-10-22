/**
 * Between the M03 worker and React, like recipeStore.ts for M04. The session (what the learner
 * chose and where they are) lives here: a change shows in it at once, so the controls never lag,
 * and the picture of the last result stays on screen, with the session it was computed from, until
 * the next one lands. The process-window chart is asked for only when its step is on screen and
 * something it depends on changed (not the dose or the focus, which it sweeps itself).
 *
 * The first session is drawn by the worker (the page does not carry the model); what the learner
 * does before it arrives is kept and applied to it, in order. The worker is created when the first
 * listener subscribes and disposed when the last one leaves, so React StrictMode (subscribe,
 * unsubscribe, subscribe) leaves no stray worker; a second subscription reuses the session.
 *
 * Framework-free on purpose: React reads it through `useSyncExternalStore` (useM03.ts).
 */
import type { ExposureInput } from '../physics/exposure';
import type { ProcessWindow } from '../physics/processWindow';
import type { M03View } from '../sim/m03';
import { windowKey } from '../sim/m03Controls';
import {
  goToStep as sessionGoToStep,
  M03_STEPS,
  setRecipe as sessionSetRecipe,
  stageOf,
  type M03Session,
} from '../sim/m03Session';
import { processWindowSpecFor } from '../sim/windowSpec';
import type { M03Client } from '../workers/m03Client';

/** The step whose screen holds the process-window chart. */
const CHART_STEP = M03_STEPS.indexOf('expose');

export interface M03State {
  /** What the learner has chosen, newest first; null until the worker has drawn the first session. */
  session: M03Session | null;
  /** The last view that arrived and the session it was computed from. */
  shown: { session: M03Session; view: M03View } | null;
  /** The last chart that arrived and the recipe it was computed for (the dose and focus in it are not used). */
  chart: { recipe: ExposureInput; window: ProcessWindow } | null;
  /** A view is on its way; `shown` stays on screen meanwhile. */
  pending: boolean;
  chartPending: boolean;
  /** The newest request failed; `shown` and `chart` still hold the last good ones. */
  error: Error | null;
}

export interface M03Store {
  subscribe(listener: () => void): () => void;
  getSnapshot(): M03State;
  setRecipe(patch: Partial<ExposureInput>): void;
  goToStep(step: number): void;
}

const toError = (value: unknown): Error =>
  value instanceof Error ? value : new Error(String(value));

export function createM03Store(createClient: () => M03Client, seed: number): M03Store {
  let state: M03State = {
    session: null,
    shown: null,
    chart: null,
    pending: false,
    chartPending: false,
    error: null,
  };
  let client: M03Client | null = null;
  /** Changes made before the first session arrived. */
  let queued: ((s: M03Session) => M03Session)[] = [];
  /** `windowKey` of the chart last asked for (or answered), so that the same one is not asked twice. */
  let askedKey: string | null = null;
  const listeners = new Set<() => void>();

  const update = (next: Partial<M03State>) => {
    state = { ...state, ...next };
    listeners.forEach((listener) => listener());
  };

  const sendView = () => {
    const mine = client;
    const session = state.session;
    if (!mine || !session) return;
    update({ pending: true, error: null });
    mine.view(session).then(
      (view) => {
        // null: a newer request replaced this one, so its answer (not this) will end the wait
        if (view === null || client !== mine) return;
        update({ shown: { session, view }, pending: false });
      },
      (error: unknown) => {
        if (client !== mine) return;
        update({ pending: false, error: toError(error) });
      },
    );
  };

  const sendChart = () => {
    const mine = client;
    const session = state.session;
    if (!mine || !session || session.step !== CHART_STEP) return;
    const key = windowKey(session.recipe);
    if (key === askedKey) return;
    askedKey = key;
    const recipe = session.recipe;
    update({ chartPending: true });
    mine.window(recipe, processWindowSpecFor(recipe.source)).then(
      (window) => {
        if (window === null || client !== mine) return;
        update({ chart: { recipe, window }, chartPending: false });
      },
      (error: unknown) => {
        if (client !== mine) return;
        askedKey = state.chart ? windowKey(state.chart.recipe) : null; // so it can be asked again
        update({ chartPending: false, error: toError(error) });
      },
    );
  };

  const apply = (change: (s: M03Session) => M03Session) => {
    if (!state.session) {
      queued.push(change);
      return;
    }
    update({ session: change(state.session) });
    sendView();
    sendChart();
  };

  const start = (mine: M03Client) => {
    mine.start(seed).then(
      (first) => {
        if (first === null || client !== mine) return;
        const session = queued.reduce((s, change) => change(s), first);
        queued = [];
        update({ session });
        sendView();
        sendChart();
      },
      (error: unknown) => {
        if (client !== mine) return;
        update({ error: toError(error) });
      },
    );
  };

  return {
    getSnapshot: () => state,
    setRecipe: (patch) => apply((s) => sessionSetRecipe(s, patch)),
    goToStep(step) {
      stageOf(step); // throws RangeError for a step that does not exist, now and not when it is applied
      apply((s) => sessionGoToStep(s, step));
    },
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) {
        const mine = createClient();
        client = mine;
        askedKey = state.chart ? windowKey(state.chart.recipe) : null;
        if (state.session) {
          sendView();
          sendChart();
        } else {
          start(mine);
        }
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && client) {
          client.dispose();
          client = null;
          state = { ...state, pending: false, chartPending: false }; // nobody is listening, so no notification
        }
      };
    },
  };
}
