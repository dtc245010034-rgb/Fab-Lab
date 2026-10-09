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
