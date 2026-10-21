import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../src/sim/random';

describe('seededRandom', () => {
  it('gives the same sequence for the same seed', () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    for (let i = 0; i < 200; i++) expect(a()).toBe(b());
  });

  it('gives different sequences for different seeds', () => {
    const first = [1, 2, 3, 4, 5, 1000, 123456789].map((seed) => seededRandom(seed)());
    expect(new Set(first).size).toBe(first.length);
  });

  it('keeps every value in [0, 1)', () => {
    const next = seededRandom(99);
    for (let i = 0; i < 20000; i++) {
      const v = next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is spread evenly enough for a scenario draw: mean near ½, each tenth of [0, 1) used', () => {
    const next = seededRandom(2024);
    const n = 20000;
    const tenths = new Array<number>(10).fill(0);
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const v = next();
      sum += v;
      tenths[Math.floor(v * 10)]!++;
    }
    expect(Math.abs(sum / n - 0.5)).toBeLessThan(0.01);
    for (const count of tenths) expect(Math.abs(count / n - 0.1)).toBeLessThan(0.01);
  });

  it('does not repeat itself early', () => {
    const next = seededRandom(5);
    const seen = new Set<number>();
    for (let i = 0; i < 5000; i++) seen.add(next());
    expect(seen.size).toBe(5000);
  });

  it('keeps its first values for fixed seeds, so a seed always means the same scenario', () => {
    // Fixtures of this implementation (mulberry32), not values from a specification: they stop a
    // change of generator from silently changing every learner's exercise.
    const first = (seed: number) => {
      const next = seededRandom(seed);
      return [next(), next(), next()];
    };
    const expected: Record<number, number[]> = {
      42: [0.60110375192, 0.448290558998, 0.85246579349],
      1: [0.627073940588, 0.00273572118, 0.52744703996],
      0: [0.266429208685, 0.000329745701, 0.223272027448],
    };
    for (const [seed, values] of Object.entries(expected)) {
      first(Number(seed)).forEach((v, i) =>
        expect(v, `seed ${seed} #${i}`).toBeCloseTo(values[i]!, 11),
      );
    }
  });

  it('accepts any whole 32-bit seed', () => {
    for (const seed of [0, 1, 2 ** 31, 2 ** 32 - 1]) {
      const v = seededRandom(seed)();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it.each([Number.NaN, 1.5, -1, 2 ** 32, Number.POSITIVE_INFINITY])('rejects seed %s', (seed) => {
    expect(() => seededRandom(seed)).toThrow(RangeError);
  });
});
