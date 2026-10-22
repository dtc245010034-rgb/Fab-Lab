/**
 * The cross-section of M03 as pixels: materials in their colours, and resist that is exposed but
 * not yet developed (the latent image) as stripes of the resist and the air colour, so it reads as
 * "about to dissolve" using only palette colours (no blended colour is ever drawn).
 */
import { describe, expect, it } from 'vitest';
import { Material } from '../../src/physics/materials';
import { gridToPixels, sectionToPixels } from '../../src/render/canvas2d/pixels';
import type { MaterialPalette } from '../../src/render/canvas2d/palette';
import { DEFAULT_M03_RECIPE } from '../../src/sim/defaults';
import { createSession, deriveView, goToStep } from '../../src/sim/m03';

const { AIR, SI, OX, PR } = Material;

const PALETTE: MaterialPalette = {
  air: [1, 2, 3],
  si: [10, 20, 30],
  ox: [40, 50, 60],
  pr: [70, 80, 90],
};

const rgba = (c: readonly number[]) => [...c, 255];
const pixelAt = (px: Uint8ClampedArray, width: number, x: number, y: number) => {
  const i = (y * width + x) * 4;
  return Array.from(px.slice(i, i + 4));
};

/** 8 × 4: air row, then a row of resist (all latent), oxide, silicon. */
function strip(latent: number[]) {
  const w = 8;
  return {
    materials: Uint8Array.from([
      ...Array<number>(w).fill(AIR),
      ...Array<number>(w).fill(PR),
      ...Array<number>(w).fill(OX),
      ...Array<number>(w).fill(SI),
    ]),
    latent: Uint8Array.from([...Array<number>(w).fill(0), ...latent, ...Array(2 * w).fill(0)]),
    widthCells: w,
    heightCells: 4,
  };
}

describe('sectionToPixels', () => {
  it('colours every cell by its material, opaque, when nothing is latent', () => {
    const px = sectionToPixels(strip(Array(8).fill(0)), PALETTE);
    expect(px).toBeInstanceOf(Uint8ClampedArray);
    expect(px.length).toBe(8 * 4 * 4);
    expect(pixelAt(px, 8, 3, 0)).toEqual(rgba(PALETTE.air));
    expect(pixelAt(px, 8, 3, 1)).toEqual(rgba(PALETTE.pr));
    expect(pixelAt(px, 8, 3, 2)).toEqual(rgba(PALETTE.ox));
    expect(pixelAt(px, 8, 3, 3)).toEqual(rgba(PALETTE.si));
  });

  it('draws latent resist as stripes of the resist and the air colour, nothing else', () => {
    const px = sectionToPixels(strip(Array(8).fill(1)), PALETTE);
    const row = Array.from({ length: 8 }, (_, x) => pixelAt(px, 8, x, 1));
    const seen = new Set(row.map((p) => p.join()));
    expect(seen).toEqual(new Set([rgba(PALETTE.pr).join(), rgba(PALETTE.air).join()]));
    // two cells of each, so the stripe is wide enough to see when a cell is a few device pixels
    expect(row.map((p) => p.join() === rgba(PALETTE.pr).join())).toEqual([
      true,
      false,
      false,
      true,
      true,
      false,
      false,
      true,
    ]);
  });

  it('slants the stripes: each row is the one above shifted by one cell', () => {
    const w = 8;
    const grid = {
      materials: new Uint8Array(w * 2).fill(PR),
      latent: new Uint8Array(w * 2).fill(1),
      widthCells: w,
      heightCells: 2,
    };
    const px = sectionToPixels(grid, PALETTE);
    const isResist = (x: number, y: number) =>
      pixelAt(px, w, x, y).join() === rgba(PALETTE.pr).join();
    for (let x = 0; x < w - 1; x++) expect(isResist(x, 1)).toBe(isResist(x + 1, 0));
  });

  it('leaves latent flags on a cell that is not resist alone', () => {
    const grid = strip(Array(8).fill(0));
    grid.latent[0] = 1; // an air cell
    const px = sectionToPixels(grid, PALETTE);
    expect(pixelAt(px, 8, 0, 0)).toEqual(rgba(PALETTE.air));
  });

  it('refuses a latent mask of another size and a material code it has no colour for', () => {
    const grid = strip(Array(8).fill(0));
    expect(() => sectionToPixels({ ...grid, latent: new Uint8Array(3) }, PALETTE)).toThrow(
      RangeError,
    );
    const bad = strip(Array(8).fill(0));
    bad.materials[0] = 99;
    expect(() => sectionToPixels(bad, PALETTE)).toThrow(/99/);
  });

  it('matches gridToPixels when no etch has reached anything: one colour per material, same bytes', () => {
    const { section } = deriveView(goToStep(createSession(1), 4)); // developed: air window, no latent
    const field = {
      arrival: new Float64Array(section.materials.length).fill(Infinity),
      maxTimeMin: 0,
    };
    expect(section.latent.every((v) => v === 0)).toBe(true);
    expect(sectionToPixels(section, PALETTE)).toEqual(gridToPixels(section, field, 0, PALETTE));
  });

  it('shows the latent image of the real exposure at step 3.4: stripes in the window, plain resist beside it', () => {
    const { section } = deriveView(goToStep(createSession(1, DEFAULT_M03_RECIPE), 3));
    const px = sectionToPixels(section, PALETTE);
    const w = section.widthCells;
    const topResistRow = section.oxideTopRow - section.resistRows;
    const inWindow = Array.from(
      { length: w },
      (_, x) => section.latent[(section.oxideTopRow - 2) * w + x],
    );
    expect(inWindow.some((v) => v === 1)).toBe(true);
    const colours = (y: number) =>
      new Set(Array.from({ length: w }, (_, x) => pixelAt(px, w, x, y).join()));
    // a row through the window holds air-coloured stripes among resist; the top row of resist is the plain colour
    expect(colours(section.oxideTopRow - 2).has(rgba(PALETTE.air).join())).toBe(true);
    expect(colours(topResistRow).has(rgba(PALETTE.pr).join())).toBe(true);
  });
});
