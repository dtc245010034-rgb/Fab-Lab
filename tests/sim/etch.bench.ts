/**
 * Recompute cost of the M04 etch at the default 260×150 grid (CLAUDE.md budget: < 50 ms on a
 * mid-range phone). Run with `npm run bench`. Not part of `npm test`: timings are machine-bound,
 * so they are reported in docs/PROGRESS.md rather than asserted.
 */
import { describe, test } from 'vitest';
import { arrivalTime } from '../../src/physics/etch';
import { printLitho } from '../../src/physics/litho';
import { DEFAULT_GRID_SPEC } from '../../src/sim/defaults';
import { buildGrid } from '../../src/sim/grid';
import { BASE_LITHO, rie, simulate, wet, type Recipe } from './helpers';

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
    test(name, async ({ bench }) => {
      const section = buildGrid(DEFAULT_GRID_SPEC, printLitho(recipe.litho), 'developed');
      const { rates } = simulate(recipe);
      await bench(`arrivalTime  ${name}`, () => {
        arrivalTime(section, rates);
      }).run();
    });
  }
});

describe('full recompute (litho → grid → rates → arrival → metrics)', () => {
  for (const [name, recipe] of cases) {
    test(name, async ({ bench }) => {
      await bench(`full         ${name}`, () => {
        simulate(recipe);
      }).run();
    });
  }
});
