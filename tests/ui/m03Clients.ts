// Test doubles for the M03 client (src/workers/m03Client.ts), like tests/ui/clients.ts for M04.
import type { ExposureInput } from '../../src/physics/exposure';
import type { ProcessWindow, ProcessWindowSpec } from '../../src/physics/processWindow';
import { createSession, runM03Request, type M03Session, type M03View } from '../../src/sim/m03';
import type { M03Client } from '../../src/workers/m03Client';

export interface TestM03Client extends M03Client {
  disposed: boolean;
  /** Every request, in order. */
  starts: number[];
  views: M03Session[];
  windows: { recipe: ExposureInput; spec: ProcessWindowSpec }[];
}

function base(): TestM03Client {
  return {
    disposed: false,
    starts: [],
    views: [],
    windows: [],
    start: async () => null,
    view: async () => null,
    window: async () => null,
    abort: () => {},
    dispose() {
      this.disposed = true;
    },
  };
}

/** Answers at once with the real model (no worker in jsdom). */
export function inlineM03Client(): TestM03Client {
  const client = base();
  client.start = async (seed, recipe) => {
    client.starts.push(seed);
    if (client.disposed) return null;
    const result = runM03Request(
      recipe ? { kind: 'start', seed, recipe } : { kind: 'start', seed },
    );
    return result.kind === 'start' ? result.session : null;
  };
  client.view = async (session) => {
    client.views.push(session);
    if (client.disposed) return null;
    const result = runM03Request({ kind: 'view', session });
    return result.kind === 'view' ? result.view : null;
  };
  client.window = async (recipe, spec) => {
    client.windows.push({ recipe, spec });
    if (client.disposed) return null;
    const result = runM03Request({ kind: 'window', recipe, spec });
    return result.kind === 'window' ? result.window : null;
  };
  return client;
}

/** Answers only when the test says so, in any order. */
export function manualM03Client() {
  const client = base();
  const starts: {
    seed: number;
    resolve: (s: M03Session | null) => void;
    reject: (e: Error) => void;
  }[] = [];
  const views: {
    session: M03Session;
    resolve: (v: M03View | null) => void;
    reject: (e: Error) => void;
  }[] = [];
  const windows: { resolve: (w: ProcessWindow | null) => void; reject: (e: Error) => void }[] = [];
  client.start = (seed) =>
    new Promise((resolve, reject) => {
      client.starts.push(seed);
      starts.push({ seed, resolve, reject });
    });
  client.view = (session) =>
    new Promise((resolve, reject) => {
      client.views.push(session);
      views.push({ session, resolve, reject });
    });
  client.window = (recipe, spec) =>
    new Promise((resolve, reject) => {
      client.windows.push({ recipe, spec });
      windows.push({ resolve, reject });
    });
  return {
    client,
    starts,
    views,
    windows,
    /** Answer the oldest unanswered start/view with the real model. */
    answerStart: (index = 0) => starts[index]!.resolve(createSession(starts[index]!.seed)),
    answerView: (index = 0) => {
      const result = runM03Request({ kind: 'view', session: views[index]!.session });
      views[index]!.resolve(result.kind === 'view' ? result.view : null);
    },
  };
}
