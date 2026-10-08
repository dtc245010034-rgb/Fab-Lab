/**
 * Recompute cost of the M04 etch at the default 260×150 grid (CLAUDE.md budget: < 50 ms on a
 * mid-range phone). Run with `npm run bench`. Not part of `npm test`: timings are machine-bound,
 * so they are reported in docs/PROGRESS.md rather than asserted.
 *
 * "limit" runs pass maxTimeMin = the largest time the slider offers, which is how the UI will call
 * it; "no limit" is the plain search over the whole grid.
 */
import { describe, test } from 'vitest';
import { arrivalTime } from '../../src/physics/etch';
import { printLitho } from '../../src/physics/litho';
import { DEFAULT_GRID_SPEC } from '../../src/sim/defaults';
import { buildGrid } from '../../src/sim/grid';
import { BASE_LITHO, rie, simulate, sliderMaxMin, wet, type Recipe } from './helpers';

const cases: [string, Recipe][] = [
  ['A  wet BOE 6:1, 800 nm window', { litho: BASE_LITHO, etch: wet('boe6', 3.3) }],
  ['B  RIE 200 W / 30 mTorr, 800 nm', { litho: BASE_LITHO, etch: rie(200, 30, 4.6) }],
  [
    'C  RIE 80 W / 180 mTorr, 400 nm',
    { litho: { ...BASE_LITHO, designNm: 400 }, etch: rie(80, 180, 9) },
  ],
];

describe('arrivalTime only', () => {
  for (const [name, recipe] of cases) {
    for (const limited of [false, true]) {
      test(`${name} ${limited ? 'limit' : 'no limit'}`, async ({ bench }) => {
        const section = buildGrid(DEFAULT_GRID_SPEC, printLitho(recipe.litho), 'developed');
        const { rates } = simulate(recipe);
        const options = limited ? { maxTimeMin: sliderMaxMin(recipe.etch) } : undefined;
        await bench(`arrivalTime  ${name}  ${limited ? 'limit   ' : 'no limit'}`, () => {
          arrivalTime(section, rates, options);
        }).run();
      });
    }
  }
});

describe('full recompute (litho → grid → rates → arrival → metrics)', () => {
  for (const [name, recipe] of cases) {
    for (const limited of [false, true]) {
      test(`${name} ${limited ? 'limit' : 'no limit'}`, async ({ bench }) => {
        const options = limited ? { maxTimeMin: sliderMaxMin(recipe.etch) } : undefined;
        await bench(`full         ${name}  ${limited ? 'limit   ' : 'no limit'}`, () => {
          simulate(recipe, undefined, options);
        }).run();
      });
    }
  }
});
