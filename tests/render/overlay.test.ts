/**
 * Geometry of the overlays (dimension lines, 500 nm scale bar, label chips) in device pixels.
 * Pure: the drawing code only strokes what this returns.
 */
import { describe, expect, it } from 'vitest';
import { overlayLayout, placeChip } from '../../src/render/canvas2d/overlay';
import { DEFAULT_RECIPE } from '../../src/sim/defaults';
import type { EtchMetrics } from '../../src/sim/grid';
import { runRecipe } from '../../src/sim/recipe';

const GRID = { widthCells: 260, heightCells: 150, cellNm: 10, oxideTopRow: 80, siTopRow: 110 };

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

describe('overlayLayout: dimension lines', () => {
  it.each([
    [1, 1],
    [3, 1],
    [6, 2],
  ])('×%d at dpr %d: line spans exactly the measured widths, centred on the grid', (k, dpr) => {
    const o = overlayLayout(GRID, metrics(), k, dpr);
    expect(o.topDim).not.toBeNull();
    expect(o.bottomDim).not.toBeNull();
    const centre = (GRID.widthCells * k) / 2;
    expect(o.topDim!.line.w).toBe((820 / 10) * k);
    expect(o.topDim!.line.x + o.topDim!.line.w / 2).toBe(centre);
    expect(o.bottomDim!.line.w).toBe((800 / 10) * k);
    expect(o.bottomDim!.line.x + o.bottomDim!.line.w / 2).toBe(centre);
  });

  it('draws the top line inside the first oxide row and the bottom line inside the last', () => {
    const k = 3;
    const o = overlayLayout(GRID, metrics(), k, 1);
    const top = o.topDim!.line;
    const bottom = o.bottomDim!.line;
    expect(top.y).toBeGreaterThanOrEqual(GRID.oxideTopRow * k);
    expect(top.y + top.h).toBeLessThanOrEqual((GRID.oxideTopRow + 1) * k);
    expect(bottom.y).toBeGreaterThanOrEqual((GRID.siTopRow - 1) * k);
    expect(bottom.y + bottom.h).toBeLessThanOrEqual(GRID.siTopRow * k);
  });

  it('is one css pixel thick but never thicker than a cell', () => {
    expect(overlayLayout(GRID, metrics(), 3, 1).topDim!.line.h).toBe(1);
    expect(overlayLayout(GRID, metrics(), 6, 2).topDim!.line.h).toBe(2);
    expect(overlayLayout(GRID, metrics(), 1, 2).topDim!.line.h).toBe(1); // k = 1 caps it
  });

  it('puts an end tick just inside each end of the line', () => {
    const o = overlayLayout(GRID, metrics(), 3, 1);
    const { line, ticks } = o.topDim!;
    expect(ticks).toHaveLength(2);
    const [left, right] = ticks as [typeof line, typeof line];
    expect(left.x).toBe(line.x);
    expect(right.x + right.w).toBe(line.x + line.w);
    for (const t of ticks) expect(t.h).toBeGreaterThan(line.h);
  });

  it('puts the top label above its line and the bottom label below its line', () => {
    const o = overlayLayout(GRID, metrics(), 3, 1);
    expect(o.topDim!.label.placement).toBe('above');
    expect(o.bottomDim!.label.placement).toBe('below');
    expect(o.topDim!.label.y).toBeLessThan(o.topDim!.line.y);
    expect(o.bottomDim!.label.y).toBeGreaterThan(o.bottomDim!.line.y);
    expect(o.topDim!.label.x).toBe((GRID.widthCells * 3) / 2);
  });

  it('draws no bottom line when the etch has not cleared the oxide', () => {
    const o = overlayLayout(GRID, metrics({ cleared: false, bottomNm: 0 }), 3, 1);
    expect(o.topDim).not.toBeNull();
    expect(o.bottomDim).toBeNull();
  });

  it('draws no lines when there is no opening at all', () => {
    const o = overlayLayout(GRID, metrics({ cleared: false, topNm: 0, bottomNm: 0 }), 3, 1);
    expect(o.topDim).toBeNull();
    expect(o.bottomDim).toBeNull();
  });

  it('matches the real default recipe: line widths are the measured top and bottom', () => {
    const { section, metrics: m } = runRecipe(DEFAULT_RECIPE);
    const o = overlayLayout(section, m, 2, 1);
    expect(o.topDim!.line.w).toBe((m.topNm / section.cellNm) * 2);
    expect(o.bottomDim!.line.w).toBe((m.bottomNm / section.cellNm) * 2);
  });
});

describe('overlayLayout: input checks', () => {
  it.each([0, -1, 1.5, NaN])('refuses scale %s (whole number ≥ 1 only)', (k) => {
    expect(() => overlayLayout(GRID, metrics(), k, 1)).toThrow(RangeError);
  });

  it.each([0, -1, NaN, Infinity])('refuses device pixel ratio %s', (dpr) => {
    expect(() => overlayLayout(GRID, metrics(), 3, dpr)).toThrow(RangeError);
  });
});

describe('overlayLayout: 500 nm scale bar', () => {
  it.each([1, 2, 3, 6])('×%d: the bar is 500 nm long, i.e. 500/cellNm cells', (k) => {
    const { scaleBar } = overlayLayout(GRID, metrics(), k, 1);
    expect(scaleBar.nm).toBe(500);
    expect(scaleBar.line.w).toBe((500 / GRID.cellNm) * k);
  });

  it('follows the cell size: 20 nm cells make a bar of 25 cells', () => {
    const { scaleBar } = overlayLayout({ ...GRID, cellNm: 20 }, metrics(), 2, 1);
    expect(scaleBar.line.w).toBe(25 * 2);
  });

  it('sits inside the canvas, in the silicon at the bottom right', () => {
    const k = 3;
    const { scaleBar } = overlayLayout(GRID, metrics(), k, 1);
    const w = GRID.widthCells * k;
    const h = GRID.heightCells * k;
    expect(scaleBar.line.x).toBeGreaterThanOrEqual(w / 2);
    expect(scaleBar.line.x + scaleBar.line.w).toBeLessThanOrEqual(w);
    expect(scaleBar.line.y).toBeGreaterThanOrEqual(GRID.siTopRow * k);
    expect(scaleBar.line.y + scaleBar.line.h).toBeLessThanOrEqual(h);
  });

  it('puts its label above the bar, centred on it', () => {
    const { scaleBar } = overlayLayout(GRID, metrics(), 3, 1);
    expect(scaleBar.label.placement).toBe('above');
    expect(scaleBar.label.x).toBe(scaleBar.line.x + scaleBar.line.w / 2);
    expect(scaleBar.label.y).toBeLessThan(scaleBar.line.y);
  });
});

describe('placeChip', () => {
  const bounds = { w: 780, h: 450 };
  const size = { w: 100, h: 20 };

  it('centres the chip on the anchor and sits it above (bottom edge on anchor) or below', () => {
    const above = placeChip({ x: 390, y: 200, placement: 'above' }, size, bounds);
    expect(above).toEqual({ x: 340, y: 180, w: 100, h: 20 });
    const below = placeChip({ x: 390, y: 200, placement: 'below' }, size, bounds);
    expect(below).toEqual({ x: 340, y: 200, w: 100, h: 20 });
  });

  it('slides back inside the canvas instead of being cut off', () => {
    expect(placeChip({ x: 10, y: 200, placement: 'above' }, size, bounds).x).toBe(0);
    const right = placeChip({ x: 775, y: 200, placement: 'above' }, size, bounds);
    expect(right.x + right.w).toBe(780);
    expect(placeChip({ x: 390, y: 5, placement: 'above' }, size, bounds).y).toBe(0);
    const low = placeChip({ x: 390, y: 445, placement: 'below' }, size, bounds);
    expect(low.y + low.h).toBe(450);
  });

  it('keeps the size when it slides', () => {
    const chip = placeChip({ x: 0, y: 0, placement: 'above' }, size, bounds);
    expect([chip.w, chip.h]).toEqual([100, 20]);
  });

  it('refuses a chip bigger than the canvas', () => {
    expect(() => placeChip({ x: 0, y: 0, placement: 'below' }, { w: 900, h: 20 }, bounds)).toThrow(
      RangeError,
    );
  });
});

describe('labels do not collide on the default recipe at the smallest scale', () => {
  // Rough monospace estimate: 0.6 em per character at 12 css px, plus 4 px padding each side.
  const chipSize = (chars: number) => ({ w: Math.ceil(chars * 7.2) + 8, h: 18 });
  const overlap = (
    a: { x: number; y: number; w: number; h: number },
    b: { x: number; y: number; w: number; h: number },
  ) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  it.each([1, 2, 3])('×%d at dpr 1', (k) => {
    const { section, metrics: m } = runRecipe(DEFAULT_RECIPE);
    const o = overlayLayout(section, m, k, 1);
    const bounds = { w: section.widthCells * k, h: section.heightCells * k };
    const top = placeChip(o.topDim!.label, chipSize('đỉnh ≈ 820 nm'.length), bounds);
    const bottom = placeChip(o.bottomDim!.label, chipSize('đáy ≈ 800 nm'.length), bounds);
    const scale = placeChip(o.scaleBar.label, chipSize('500 nm'.length), bounds);
    expect(overlap(top, bottom)).toBe(false);
    expect(overlap(top, scale)).toBe(false);
    expect(overlap(bottom, scale)).toBe(false);
  });
});
