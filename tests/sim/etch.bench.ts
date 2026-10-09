/**
 * Recompute cost of the M04 etch at the default 260×150 grid (CLAUDE.md budget: < 50 ms on a
 * mid-range phone). Run with `npm run bench`. Not part of `npm test`: timings are machine-bound,
 * so they are reported in docs/PROGRESS.md rather than asserted.
 *
 * `arrivalTime` is timed with and without `maxTimeMin` (= the largest time the time control
 * offers, which is how the app calls it). The full recompute is `runRecipe`, which always passes it.
 */
import { describe, test } from 'vitest';
import { arrivalTime } from '../../src/physics/etch';
import { M04_CASES } from '../../src/sim/cases';
import { etchTimeMaxMin, runRecipe } from '../../src/sim/recipe';

const NAMES = {
  A: 'A  wet BOE 6:1, 800 nm window',
  B: 'B  RIE 200 W / 30 mTorr, 800 nm',
  C: 'C  RIE 80 W / 180 mTorr, 400 nm',
} as const;

describe('arrivalTime only', () => {
  for (const { id, recipe } of M04_CASES) {
    for (const limited of [false, true]) {
      test(`${NAMES[id]} ${limited ? 'limit' : 'no limit'}`, async ({ bench }) => {
        const { section, rates } = runRecipe(recipe);
        const options = limited ? { maxTimeMin: etchTimeMaxMin(recipe.etch) } : undefined;
        await bench(`arrivalTime  ${NAMES[id]}  ${limited ? 'limit   ' : 'no limit'}`, () => {
          arrivalTime(section, rates, options);
        }).run();
      });
    }
  }
});

describe('full recompute (runRecipe: litho → grid → rates → arrival → metrics)', () => {
  for (const { id, recipe } of M04_CASES) {
    test(NAMES[id], async ({ bench }) => {
      await bench(`full         ${NAMES[id]}  limit   `, () => {
        runRecipe(recipe);
      }).run();
    });
  }
});
