/**
 * `summarize` turns the samples of `?bench=1` into the three numbers the project reports in
 * docs/PROGRESS.md: median, p95 and maximum. p95 is the nearest-rank percentile: the smallest
 * sample that at least 95 % of the samples do not exceed.
 */
import { describe, expect, it } from 'vitest';
import { summarize } from '../../src/sim/stats';

const upTo = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
const shuffled = (xs: number[]) => [...xs].sort((a, b) => ((a * 7919) % 31) - ((b * 7919) % 31));

describe('summarize', () => {
  it('median of an odd count is the middle sample, whatever the order', () => {
    expect(summarize([3, 1, 2]).medianMs).toBe(2);
    expect(summarize(shuffled(upTo(29))).medianMs).toBe(15);
  });

  it('median of an even count is the mean of the two middle samples', () => {
    expect(summarize([4, 1, 3, 2]).medianMs).toBe(2.5);
    expect(summarize(shuffled(upTo(30))).medianMs).toBe(15.5);
  });

  it.each([
    [1, 1],
    [2, 2],
    [20, 19],
    [30, 29], // the 30 samples of ?bench=1: the second largest
    [100, 95],
  ])('p95 of 1..%d is the nearest-rank sample %d', (n, expected) => {
    expect(summarize(shuffled(upTo(n))).p95Ms).toBe(expected);
  });

  it('the maximum is the largest sample, and p95 never exceeds it', () => {
    const s = summarize([5, 9, 1, 7]);
    expect(s.maxMs).toBe(9);
    expect(s.p95Ms).toBeLessThanOrEqual(s.maxMs);
  });

  it('counts the samples', () => {
    expect(summarize(upTo(30)).count).toBe(30);
  });

  it('one sample is its own median, p95 and maximum', () => {
    expect(summarize([4.2])).toEqual({ count: 1, medianMs: 4.2, p95Ms: 4.2, maxMs: 4.2 });
  });

  it('leaves the array it was given alone', () => {
    const samples = [3, 1, 2];
    summarize(samples);
    expect(samples).toEqual([3, 1, 2]);
  });

  it('refuses nothing to summarize, and refuses a sample that is not a finite number', () => {
    expect(() => summarize([])).toThrow(RangeError);
    expect(() => summarize([1, NaN])).toThrow(RangeError);
    expect(() => summarize([1, Infinity])).toThrow(RangeError);
  });
});
