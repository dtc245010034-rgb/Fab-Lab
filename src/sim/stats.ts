/**
 * The three numbers the project reports for timings (docs/PROGRESS.md): median, p95, maximum.
 * Shared by `?bench=1` and anything else that times the recompute.
 */
export interface Summary {
  count: number;
  medianMs: number;
  /** Nearest-rank percentile: the smallest sample that at least 95 % of the samples do not exceed. */
  p95Ms: number;
  maxMs: number;
}

/** Throws RangeError for no samples or a sample that is not a finite number. */
export function summarize(samplesMs: readonly number[]): Summary {
  if (samplesMs.length === 0) throw new RangeError('summarize needs at least one sample');
  if (!samplesMs.every(Number.isFinite)) throw new RangeError('samples must be finite numbers');
  const sorted = [...samplesMs].sort((a, b) => a - b);
  const n = sorted.length;
  const middle = n >> 1;
  return {
    count: n,
    medianMs: n % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2,
    // 95 n / 100 in integers: 0.95 * n can land a hair above a whole number and round up a rank
    p95Ms: sorted[Math.ceil((95 * n) / 100) - 1]!,
    maxMs: sorted[n - 1]!,
  };
}
