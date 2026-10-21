/**
 * Seeded random numbers (CLAUDE.md: no randomness without a seed). mulberry32: a small generator
 * with a 32-bit state, good enough to draw a learner's exercise from a seed. Not for anything
 * that needs statistical or cryptographic quality.
 */

/** A function that returns the next number in [0, 1) each time it is called; `seed` is a whole 32-bit number. */
export function seededRandom(seed: number): () => number {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError(`seed must be a whole number in [0, 2^32), got ${seed}`);
  }
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
