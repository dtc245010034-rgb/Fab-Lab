/**
 * Pure grid → pixel mapping of the cross-section renderer. No canvas involved: the arrays it
 * returns are what gets handed to ImageData.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ArrivalField, MaterialGrid } from '../../src/physics/etch';
import { Material } from '../../src/physics/materials';
import {
  chooseScale,
  formatApproxNm,
  gridToPixels,
  planCanvas,
  roundToResolution,
} from '../../src/render/canvas2d/pixels';
import { surroundRects } from '../../src/render/canvas2d/overlay';
import { paletteFromTokens, type MaterialPalette } from '../../src/render/canvas2d/palette';
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

describe('planCanvas', () => {
  const GRID = { widthCells: 260, heightCells: 150 };

  it.each([
    // [available css px, dpr, scale, grid image width (device px), backing store, css size, grid x]
    [810, 1, 3, 780, [810, 450], [810, 450], 15], // desktop: the canvas fills the container
    [810, 2, 6, 1560, [1620, 900], [810, 450], 30], // desktop, retina: same css size, twice the pixels
    [317, 1, 1, 260, [317, 150], [317, 150], 28], // 380 px phone, dpr 1: 57 px left over, split in two
    [317, 2, 2, 520, [634, 300], [317, 150], 57],
    [317, 3, 3, 780, [951, 450], [317, 150], 85], // 380 px phone, dpr 3
    [810, 1.25, 3, 780, [1012, 450], [809.6, 360], 116], // Windows scaling: whole device pixels
  ])('%d css px at dpr %d → ×%d', (avail, dpr, scale, gridW, backing, css, gridX) => {
    const plan = planCanvas(GRID, avail, dpr);
    expect(plan.scale).toBe(scale);
    expect(plan.gridWidthPx).toBe(gridW);
    expect([plan.widthPx, plan.heightPx]).toEqual(backing);
    expect([plan.cssWidth, plan.cssHeight]).toEqual(css);
    expect(plan.gridX).toBe(gridX);
  });

  it('never makes the canvas narrower than the grid image, so the grid is never cut', () => {
    const plan = planCanvas(GRID, 200, 1); // container narrower than the grid: still ×1
    expect(plan.scale).toBe(1);
    expect(plan.gridWidthPx).toBe(260);
    expect(plan.widthPx).toBe(260);
    expect(plan.gridX).toBe(0);
  });

  it('always maps the backing store to whole device pixels, whatever the ratio', () => {
    for (const dpr of [1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4]) {
      const plan = planCanvas(GRID, 700, dpr);
      expect(plan.gridWidthPx).toBe(GRID.widthCells * plan.scale);
      expect(plan.heightPx).toBe(GRID.heightCells * plan.scale);
      expect(Number.isInteger(plan.widthPx)).toBe(true);
      expect(Number.isInteger(plan.gridX)).toBe(true);
      expect(plan.gridX + plan.gridWidthPx).toBeLessThanOrEqual(plan.widthPx);
      expect(plan.cssWidth * dpr).toBeCloseTo(plan.widthPx, 6);
      expect(plan.cssHeight * dpr).toBeCloseTo(plan.heightPx, 6);
    }
  });

  it('never makes the canvas wider than its container', () => {
    for (const [avail, dpr] of [
      [810, 1],
      [810, 1.25],
      [317, 3],
      [701, 1.5],
    ] as const) {
      expect(planCanvas(GRID, avail, dpr).cssWidth).toBeLessThanOrEqual(avail);
    }
  });

  it('refuses a container with no width or a bad pixel ratio', () => {
    expect(() => planCanvas(GRID, 0, 1)).toThrow(RangeError);
    expect(() => planCanvas(GRID, 500, 0)).toThrow(RangeError);
    expect(() => planCanvas(GRID, 500, NaN)).toThrow(RangeError);
  });
});

describe('the canvas outside the grid', () => {
  const GRID = { widthCells: 260, heightCells: 150 };

  /** The real token values, read from the stylesheet the page loads. */
  const realPalette = () => {
    const css = readFileSync(
      fileURLToPath(new URL('../../src/ui/styles/tokens.css', import.meta.url)),
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\//g, '');
    const values = new Map<string, string>();
    for (const m of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) values.set(m[1]!, m[2]!);
    return paletteFromTokens((token) => values.get(token) ?? '');
  };

  /** What a canvas shows after `surroundRects` are filled with `colour`; the rest stays `empty`. */
  const paint = (
    plan: ReturnType<typeof planCanvas>,
    colour: readonly [number, number, number],
    empty: readonly [number, number, number],
  ) => {
    const { widthPx, heightPx } = plan;
    const px = new Uint8ClampedArray(widthPx * heightPx * 4);
    for (let i = 0; i < widthPx * heightPx; i++) px.set([...empty, 255], i * 4);
    for (const r of surroundRects(plan)) {
      for (let y = r.y; y < r.y + r.h; y++) {
        for (let x = r.x; x < r.x + r.w; x++) px.set([...colour, 255], (y * widthPx + x) * 4);
      }
    }
    return px;
  };

  it.each([
    [810, 1],
    [810, 2],
    [317, 1],
    [317, 3],
    [810, 1.25],
    [701, 1.5],
    [200, 1],
  ])(
    '%d css px at dpr %d: every pixel outside the grid has the surround colour, not air',
    (avail, dpr) => {
      const { materials, surround } = realPalette();
      const plan = planCanvas(GRID, avail, dpr);
      const EMPTY = [255, 0, 255] as const; // not a token: shows any pixel nobody painted
      const px = paint(plan, surround, EMPTY);
      const same = (i: number, c: readonly number[]) =>
        px[i] === c[0] && px[i + 1] === c[1] && px[i + 2] === c[2];
      // one assertion at the end: a failing pixel is named, and 1.4 M pixels stay fast
      const wrong: string[] = [];
      let outside = 0;
      for (let y = 0; y < plan.heightPx; y++) {
        for (let x = 0; x < plan.widthPx; x++) {
          const i = (y * plan.widthPx + x) * 4;
          const inGrid = x >= plan.gridX && x < plan.gridX + plan.gridWidthPx;
          if (inGrid) {
            if (!same(i, EMPTY)) wrong.push(`(${x}, ${y}) inside the grid was painted`);
          } else {
            outside++;
            if (!same(i, surround)) wrong.push(`(${x}, ${y}) outside the grid is not the surround`);
            if (same(i, materials.air)) wrong.push(`(${x}, ${y}) outside the grid is air-coloured`);
          }
        }
      }
      expect(wrong.slice(0, 5)).toEqual([]);
      // a container wider than the grid really has margins to check
      if (plan.widthPx > plan.gridWidthPx) expect(outside).toBeGreaterThan(0);
    },
  );
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
