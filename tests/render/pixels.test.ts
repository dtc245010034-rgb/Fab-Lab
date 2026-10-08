/**
 * Pure grid → pixel mapping of the cross-section renderer. No canvas involved: the arrays it
 * returns are what gets handed to ImageData.
 */
import { describe, expect, it } from 'vitest';
import { Material, type ArrivalField, type MaterialGrid } from '../../src/physics/etch';
import {
  chooseScale,
  formatApproxNm,
  gridToPixels,
  roundToResolution,
} from '../../src/render/canvas2d/pixels';
import type { MaterialPalette } from '../../src/render/canvas2d/palette';
import { DEFAULT_RECIPE } from '../../src/sim/defaults';
import { runRecipe } from '../../src/sim/recipe';
import { BASE_LITHO, wet } from '../sim/helpers';

const { AIR, SI, OX, PR } = Material;

/** Four colours that differ in every channel, so any mix-up shows. */
const PALETTE: MaterialPalette = {
  air: [1, 2, 3],
  si: [10, 20, 30],
  ox: [40, 50, 60],
  pr: [70, 80, 90],
};

const pixelAt = (pixels: Uint8ClampedArray, width: number, x: number, y: number) => {
  const i = (y * width + x) * 4;
  return Array.from(pixels.slice(i, i + 4));
};

/** 3 × 3: air on top, resist | oxide | resist, silicon at the bottom. */
const tiny = (arrival: number[], maxTimeMin = 10) => {
  const grid: MaterialGrid = {
    materials: Uint8Array.from([AIR, AIR, AIR, PR, OX, PR, SI, SI, SI]),
    widthCells: 3,
    heightCells: 3,
    cellNm: 10,
  };
  const field: ArrivalField = { arrival: Float64Array.from(arrival), maxTimeMin };
  return { grid, field };
};

const NEVER = Infinity;
// arrival time per cell of `tiny`; air is 0 by definition of the field.
const TINY_ARRIVAL = [0, 0, 0, NEVER, 2, NEVER, NEVER, 5, NEVER];

describe('gridToPixels', () => {
  it('returns RGBA for every cell, opaque, in the colour of its material', () => {
    const { grid, field } = tiny(TINY_ARRIVAL);
    const px = gridToPixels(grid, field, 0, PALETTE);
    expect(px).toBeInstanceOf(Uint8ClampedArray);
    expect(px.length).toBe(3 * 3 * 4);
    expect(pixelAt(px, 3, 1, 0)).toEqual([1, 2, 3, 255]); // air
    expect(pixelAt(px, 3, 0, 1)).toEqual([70, 80, 90, 255]); // resist
    expect(pixelAt(px, 3, 1, 1)).toEqual([40, 50, 60, 255]); // oxide
    expect(pixelAt(px, 3, 2, 2)).toEqual([10, 20, 30, 255]); // silicon
  });

  it('shows a cell as etched (air colour) once its arrival time is ≤ the etch time', () => {
    const { grid, field } = tiny(TINY_ARRIVAL);
    const before = gridToPixels(grid, field, 1.99, PALETTE);
    const exactly = gridToPixels(grid, field, 2, PALETTE);
    expect(pixelAt(before, 3, 1, 1)).toEqual([40, 50, 60, 255]);
    expect(pixelAt(exactly, 3, 1, 1)).toEqual([1, 2, 3, 255]);
    // silicon under the window arrives later (5 min) and is still there at 2 min
    expect(pixelAt(exactly, 3, 1, 2)).toEqual([10, 20, 30, 255]);
    expect(pixelAt(gridToPixels(grid, field, 5, PALETTE), 3, 1, 2)).toEqual([1, 2, 3, 255]);
  });

  it('never etches a cell the front does not reach (Infinity), however long the etch', () => {
    const { grid, field } = tiny(TINY_ARRIVAL, 1000);
    const px = gridToPixels(grid, field, 1000, PALETTE);
    expect(pixelAt(px, 3, 0, 1)).toEqual([70, 80, 90, 255]);
    expect(pixelAt(px, 3, 2, 2)).toEqual([10, 20, 30, 255]);
  });

  it('at time 0 nothing is etched: the picture is the start condition', () => {
    const { grid, field } = tiny(TINY_ARRIVAL);
    const px = gridToPixels(grid, field, 0, PALETTE);
    expect(pixelAt(px, 3, 1, 1)).toEqual([40, 50, 60, 255]);
    expect(pixelAt(px, 3, 1, 2)).toEqual([10, 20, 30, 255]);
  });

  it('refuses a time beyond the arrival field (it would silently under-draw the etch)', () => {
    const { grid, field } = tiny(TINY_ARRIVAL, 10);
    expect(() => gridToPixels(grid, field, 10.01, PALETTE)).toThrow(RangeError);
    expect(() => gridToPixels(grid, field, 10, PALETTE)).not.toThrow();
  });

  it.each([-1, NaN, Infinity])('refuses etch time %s', (t) => {
    const { grid, field } = tiny(TINY_ARRIVAL, Infinity);
    expect(() => gridToPixels(grid, field, t, PALETTE)).toThrow(RangeError);
  });

  it('refuses an arrival field that does not match the grid', () => {
    const { grid } = tiny(TINY_ARRIVAL);
    const short: ArrivalField = { arrival: new Float64Array(4), maxTimeMin: 10 };
    expect(() => gridToPixels(grid, short, 1, PALETTE)).toThrow(RangeError);
  });

  it('refuses a material code it has no colour for', () => {
    const { grid, field } = tiny(TINY_ARRIVAL);
    grid.materials[4] = 9;
    expect(() => gridToPixels(grid, field, 0, PALETTE)).toThrow(RangeError);
  });
});

describe('gridToPixels agrees with measureEtch on the real default recipe', () => {
  /** Length of the run of air-coloured pixels through the centre column of `row`. */
  const openRun = (px: Uint8ClampedArray, width: number, row: number) => {
    const isAir = (x: number) => pixelAt(px, width, x, row).slice(0, 3).join() === '1,2,3';
    const cx = width / 2;
    let a = cx;
    let b = cx - 1;
    while (a > 0 && isAir(a - 1)) a--;
    while (b < width - 1 && isAir(b + 1)) b++;
    return b - a + 1;
  };

  it('case B (RIE): opening widths at the oxide top and bottom equal the reported metrics', () => {
    const { section, field, metrics, litho } = runRecipe(DEFAULT_RECIPE);
    const px = gridToPixels(section, field, DEFAULT_RECIPE.etch.timeMin, PALETTE);
    expect(litho.printedNm).toBeGreaterThan(0);
    expect(openRun(px, section.widthCells, section.oxideTopRow) * section.cellNm).toBe(
      metrics.topNm,
    );
    expect(openRun(px, section.widthCells, section.siTopRow - 1) * section.cellNm).toBe(
      metrics.bottomNm,
    );
  });

  it('case A (wet BOE 6:1): the sloped opening is drawn as measured', () => {
    const { section, field, metrics } = runRecipe({ litho: BASE_LITHO, etch: wet('boe6', 3.3) });
    const px = gridToPixels(section, field, 3.3, PALETTE);
    expect(metrics.topNm).toBeGreaterThan(metrics.bottomNm);
    expect(openRun(px, section.widthCells, section.oxideTopRow) * section.cellNm).toBe(
      metrics.topNm,
    );
    expect(openRun(px, section.widthCells, section.siTopRow - 1) * section.cellNm).toBe(
      metrics.bottomNm,
    );
  });
});

describe('chooseScale', () => {
  it.each([
    [780, 260, 3],
    [1560, 260, 6],
    [779, 260, 2],
    [520, 260, 2],
    [259, 260, 1], // narrower than the grid: still 1, never a fraction
    [100, 260, 1],
  ])('%d device px for %d cells → ×%d', (avail, cells, k) => {
    expect(chooseScale(avail, cells)).toBe(k);
  });

  it.each([NaN, Infinity, 0, -5])('refuses available width %s', (avail) => {
    expect(() => chooseScale(avail, 260)).toThrow(RangeError);
  });

  it('refuses a cell count that is not a positive whole number', () => {
    expect(() => chooseScale(500, 0)).toThrow(RangeError);
    expect(() => chooseScale(500, 2.5)).toThrow(RangeError);
  });
});

describe('displayed numbers (grid resolution is one cell)', () => {
  it.each([
    [823, 10, 820],
    [825, 10, 830],
    [800, 10, 800],
    [4, 10, 0],
    [1444, 10, 1440],
  ])('%d nm at %d nm resolution → %d nm', (nm, res, expected) => {
    expect(roundToResolution(nm, res)).toBe(expected);
  });

  it('formats with a leading ≈ and the unit, rounded to the resolution', () => {
    expect(formatApproxNm(823, 10)).toBe('≈ 820 nm');
    expect(formatApproxNm(800, 10)).toBe('≈ 800 nm');
    expect(formatApproxNm(1040, 10)).toBe('≈ 1040 nm');
  });

  it('follows the grid resolution, not a hard-coded 10', () => {
    expect(formatApproxNm(823, 5)).toBe('≈ 825 nm');
    expect(formatApproxNm(823, 20)).toBe('≈ 820 nm');
  });

  it('refuses values it cannot round meaningfully', () => {
    expect(() => roundToResolution(NaN, 10)).toThrow(RangeError);
    expect(() => roundToResolution(800, 0)).toThrow(RangeError);
    expect(() => roundToResolution(800, -10)).toThrow(RangeError);
  });
});
