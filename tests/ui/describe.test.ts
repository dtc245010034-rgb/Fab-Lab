/**
 * Short Vietnamese strings the Viewer builds from numbers: the canvas description for screen
 * readers, the recipe line and the `?debug=1` readout.
 */
import { describe, expect, it } from 'vitest';
import {
  describeRecipe,
  describeSection,
  formatMs,
  formatViNumber,
  isBenchRequested,
  isDebugRequested,
} from '../../src/ui/describe';
import type { EtchMetrics } from '../../src/sim/grid';
import { DEFAULT_RECIPE } from '../../src/sim/defaults';

const metrics = (over: Partial<EtchMetrics> = {}): EtchMetrics => ({
  printedNm: 800,
  cleared: true,
  topNm: 820,
  bottomNm: 800,
  undercutNm: 10,
  siLossNm: 0,
  resistLeftNm: 500,
  sidewallAngleDeg: 88,
  ...over,
});

describe('describeSection (canvas aria-label)', () => {
  it('says the window reached silicon and gives top and bottom as ≈ sizes', () => {
    expect(describeSection(metrics(), 10)).toBe(
      'Mặt cắt wafer: cửa sổ đã thủng tới Si, đỉnh ≈ 820 nm, đáy ≈ 800 nm.',
    );
  });

  it('rounds to the grid resolution', () => {
    expect(describeSection(metrics({ topNm: 823, bottomNm: 797 }), 10)).toContain('đỉnh ≈ 820 nm');
    expect(describeSection(metrics({ topNm: 823, bottomNm: 797 }), 10)).toContain('đáy ≈ 800 nm');
  });

  it('says so when the etch has not gone through the oxide yet', () => {
    expect(describeSection(metrics({ cleared: false, bottomNm: 0 }), 10)).toBe(
      'Mặt cắt wafer: chưa thủng hết lớp oxit, đỉnh ≈ 820 nm.',
    );
  });

  it('says so when there is no opening at all', () => {
    expect(describeSection(metrics({ cleared: false, topNm: 0, bottomNm: 0 }), 10)).toBe(
      'Mặt cắt wafer: chưa có cửa sổ nào mở trong lớp oxit.',
    );
  });
});

describe('formatViNumber', () => {
  it.each([
    [4.6, '4,6'],
    [200, '200'],
    [0.5, '0,5'],
    [3.3, '3,3'],
  ])('%d → %s', (x, text) => {
    expect(formatViNumber(x)).toBe(text);
  });
});

describe('describeRecipe', () => {
  it('writes the default RIE recipe the way the spec does', () => {
    expect(describeRecipe(DEFAULT_RECIPE.etch)).toBe('RIE 200 W · 30 mTorr · 4,6 phút');
  });

  it.each([
    ['boe10', 'BOE 10:1'],
    ['boe6', 'BOE 6:1'],
    ['hf49', 'HF 49%'],
  ] as const)('names the wet etchant %s as %s', (etchant, name) => {
    expect(describeRecipe({ mode: 'wet', etchant, timeMin: 3.3 })).toBe(`${name} · 3,3 phút`);
  });
});

describe('formatMs', () => {
  it.each([
    [6.14, '6,1 ms'],
    [6.15, '6,2 ms'],
    [0, '0,0 ms'],
    [12, '12,0 ms'],
    [0.04, '0,0 ms'],
  ])('%d → %s', (ms, text) => {
    expect(formatMs(ms)).toBe(text);
  });
});

describe('isDebugRequested', () => {
  it.each([
    ['?debug=1', true],
    ['?a=b&debug=1', true],
    ['?debug=1&a=b', true],
  ])('%s → debug', (search, expected) => {
    expect(isDebugRequested(search)).toBe(expected);
  });

  it.each(['', '?', '?debug', '?debug=', '?debug=0', '?debug=true', '?debug=11', '?xdebug=1'])(
    '%j → no debug',
    (search) => {
      expect(isDebugRequested(search)).toBe(false);
    },
  );
});

describe('isBenchRequested', () => {
  it.each(['?bench=1', '?a=b&bench=1', '?bench=1&debug=1'])('%s → bench', (search) => {
    expect(isBenchRequested(search)).toBe(true);
  });

  it.each(['', '?', '?bench', '?bench=', '?bench=0', '?bench=true', '?bench=11', '?xbench=1'])(
    '%j → no bench',
    (search) => {
      expect(isBenchRequested(search)).toBe(false);
    },
  );
});
