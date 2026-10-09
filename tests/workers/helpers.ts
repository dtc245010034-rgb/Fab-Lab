// Shared by the worker tests.

/**
 * A "yield" the test releases by hand. Each `release()` lets exactly the waiting turn proceed, so
 * the order in which a SimService computes things is deterministic: one computation per release.
 */
export function manualYield() {
  const waiters: (() => void)[] = [];
  return {
    yieldToEventLoop: () => new Promise<void>((resolve) => waiters.push(resolve)),
    release: () => waiters.splice(0).forEach((resolve) => resolve()),
    /** How many turns are waiting to be released. */
    get waiting() {
      return waiters.length;
    },
  };
}

/** Lets promise callbacks that are already due run (not a timer: nothing here waits for time). */
export const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Releases the yields of a SimService one turn at a time until `promise` has settled. */
export async function drive<T>(
  gate: { release: () => void },
  promise: Promise<T>,
  maxTurns = 1000,
): Promise<T> {
  let done = false;
  const watched = promise.finally(() => {
    done = true;
  });
  watched.catch(() => {}); // the caller handles a rejection; this branch must not report it too
  for (let turn = 0; !done; turn++) {
    if (turn >= maxTurns) throw new Error(`still pending after ${maxTurns} turns`);
    gate.release();
    await settle();
  }
  return watched;
}
