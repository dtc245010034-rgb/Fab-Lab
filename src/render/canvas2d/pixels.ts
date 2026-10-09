/**
 * Pure mapping from a cross-section grid to pixels, plus the whole-number scale and the rounding
 * rule for the numbers shown. No canvas here: `gridToPixels` returns what goes into ImageData.
 */
import type { ArrivalField, MaterialGrid } from '../../physics/etch';
import { Material } from '../../physics/materials';
import type { MaterialPalette, Rgb } from './palette';

const { AIR } = Material;

/**
 * RGBA bytes, row-major, one pixel per grid cell. A cell shows as etched (the air colour) when the
 * front has reached it by `timeMin`, the same test as `measureEtch`, so the picture and the numbers
 * cannot disagree. Throws RangeError for an arrival field of another size, an etch time that is
 * negative or not finite, or one beyond `field.maxTimeMin` (later cells are stored as Infinity and
 * would wrongly look untouched).
 */
export function gridToPixels(
  grid: MaterialGrid,
  field: ArrivalField,
  timeMin: number,
  palette: MaterialPalette,
): Uint8ClampedArray<ArrayBuffer> {
  const { materials, widthCells, heightCells } = grid;
  const { arrival, maxTimeMin } = field;
  if (arrival.length !== materials.length || materials.length !== widthCells * heightCells) {
    throw new RangeError(
      `arrival has ${arrival.length} cells, grid has ${materials.length} (${widthCells} × ${heightCells})`,
    );
  }
  if (!Number.isFinite(timeMin) || timeMin < 0) {
    throw new RangeError(`timeMin must be a finite number ≥ 0, got ${timeMin}`);
  }
  if (timeMin > maxTimeMin) {
    throw new RangeError(
      `timeMin ${timeMin} is beyond maxTimeMin ${maxTimeMin} of the arrival field; recompute it`,
    );
  }

  const colourOf: Rgb[] = [];
  colourOf[Material.AIR] = palette.air;
  colourOf[Material.SI] = palette.si;
  colourOf[Material.OX] = palette.ox;
  colourOf[Material.PR] = palette.pr;

  const pixels = new Uint8ClampedArray(materials.length * 4);
  for (let i = 0; i < materials.length; i++) {
    const m = materials[i]!;
    const base = colourOf[m];
    if (!base) throw new RangeError(`no colour for material code ${m} at cell ${i}`);
    const [r, g, b] = m !== AIR && arrival[i]! <= timeMin ? palette.air : base;
    const o = i * 4;
    pixels[o] = r;
    pixels[o + 1] = g;
    pixels[o + 2] = b;
    pixels[o + 3] = 255;
  }
  return pixels;
}

/**
 * Largest whole number of device pixels per grid cell that fits `availableDevicePx`, at least 1.
 * Whole numbers only: a fractional scale would make some cells wider than others.
 */
export function chooseScale(availableDevicePx: number, cells: number): number {
  if (!Number.isFinite(availableDevicePx) || availableDevicePx <= 0) {
    throw new RangeError(
      `availableDevicePx must be a positive finite number, got ${availableDevicePx}`,
    );
  }
  if (!Number.isInteger(cells) || cells <= 0) {
    throw new RangeError(`cells must be a positive whole number, got ${cells}`);
  }
  return Math.max(1, Math.floor(availableDevicePx / cells));
}

export interface CanvasPlan {
  /** Device pixels per grid cell, a whole number. */
  scale: number;
  /** Width of the grid image (cells × scale), device pixels. */
  gridWidthPx: number;
  /** Where the grid image starts on the canvas, device pixels; the rest is the surround. */
  gridX: number;
  /** Size of the canvas backing store, device pixels. `heightPx` is also the grid image's height. */
  widthPx: number;
  heightPx: number;
  /** Size to give the canvas in css pixels so that one device pixel is one backing-store pixel. */
  cssWidth: number;
  cssHeight: number;
}

/**
 * Sizes the canvas for a container `availableCssWidth` wide on a screen with ratio `dpr`. The grid
 * image is a whole number of device pixels per cell, so it is usually narrower than the container;
 * the canvas takes the full container width and centres the grid in it, and what is left on both
 * sides is drawn as surround rather than left to whatever is behind the canvas.
 */
export function planCanvas(
  grid: { widthCells: number; heightCells: number },
  availableCssWidth: number,
  dpr: number,
): CanvasPlan {
  if (!Number.isFinite(dpr) || dpr <= 0) {
    throw new RangeError(`dpr must be a positive finite number, got ${dpr}`);
  }
  const availableDevicePx = Math.floor(availableCssWidth * dpr);
  const scale = chooseScale(availableDevicePx, grid.widthCells);
  const gridWidthPx = grid.widthCells * scale;
  // A container narrower than the grid at ×1 keeps the whole grid; css max-width shrinks it.
  const widthPx = Math.max(gridWidthPx, availableDevicePx);
  const heightPx = grid.heightCells * scale;
  return {
    scale,
    gridWidthPx,
    gridX: Math.floor((widthPx - gridWidthPx) / 2),
    widthPx,
    heightPx,
    cssWidth: widthPx / dpr,
    cssHeight: heightPx / dpr,
  };
}

/** Rounds to the grid resolution (one cell), the finest size the picture can tell apart. */
export function roundToResolution(nm: number, resolutionNm: number): number {
  if (!Number.isFinite(nm)) throw new RangeError(`nm must be finite, got ${nm}`);
  if (!Number.isFinite(resolutionNm) || resolutionNm <= 0) {
    throw new RangeError(`resolutionNm must be a positive finite number, got ${resolutionNm}`);
  }
  return Math.round(nm / resolutionNm) * resolutionNm;
}

/** "≈ 820 nm": a size read off a grid is only as exact as one cell. */
export function formatApproxNm(nm: number, resolutionNm: number): string {
  return `≈ ${roundToResolution(nm, resolutionNm)} nm`;
}
