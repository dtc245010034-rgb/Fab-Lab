/**
 * `drawCrossSection` for M03: the same frame, zigzag edges, dimension line and 500 nm bar as the
 * etch lab, but the pixels come from the section itself (no arrival field to read). Recorded on a
 * stand-in canvas like tests/render/crossSectionM04.test.ts, which pins the M04 path.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { drawCrossSection } from '../../src/render/canvas2d/crossSection';
import type { RenderPalette } from '../../src/render/canvas2d/palette';
import { sectionToPixels } from '../../src/render/canvas2d/pixels';
import { createSession, deriveView, goToStep } from '../../src/sim/m03';

const PALETTE: RenderPalette = {
  materials: { air: [1, 2, 3], si: [10, 20, 30], ox: [40, 50, 60], pr: [70, 80, 90] },
  ink: [200, 201, 202],
  chip: [5, 6, 7],
  surround: [100, 110, 120],
  fontStack: '"JetBrains Mono", monospace',
};

class FakeImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  constructor(data: Uint8ClampedArray, width: number, height: number) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
}

/** A canvas whose contexts note what they are asked to do. */
function stage() {
  const texts: string[] = [];
  const images: FakeImageData[] = [];
  const rects: number[][] = [];
  const noop = () => {};
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(target, name: string) {
      if (name === 'measureText') return (text: string) => ({ width: text.length * 7 });
      if (name === 'fillText') return (text: string) => void texts.push(text);
      if (name === 'fillRect') return (...a: number[]) => void rects.push(a);
      return target[name] ?? noop;
    },
    set(target, name: string, value) {
      target[name] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  const bufferCtx = {
    putImageData: (image: FakeImageData) => void images.push(image),
  } as unknown as CanvasRenderingContext2D;
  const buffer = { width: 0, height: 0, getContext: () => bufferCtx };
  const canvas = {
    width: 0,
    height: 0,
    style: {} as Record<string, string>,
    getContext: () => ctx,
    ownerDocument: { createElement: () => buffer },
  } as unknown as HTMLCanvasElement;
  return { canvas, texts, images, rects };
}

const OPTIONS = {
  palette: PALETTE,
  labels: { top: 'chân', bottom: 'đáy' },
  availableCssWidth: 380,
  dpr: 2,
};

afterEach(() => vi.unstubAllGlobals());

describe('drawCrossSection without an etch (M03)', () => {
  it('paints the pixels of the section, latent stripes included, and no etch is read', () => {
    vi.stubGlobal('ImageData', FakeImageData);
    const { section } = deriveView(goToStep(createSession(1), 3));
    const { canvas, images } = stage();
    const drawn = drawCrossSection(
      canvas,
      { section, metrics: { topNm: 0, bottomNm: 0, cleared: false } },
      OPTIONS,
    );
    expect(drawn).not.toBeNull();
    expect(images).toHaveLength(1);
    expect(Array.from(images[0]!.data)).toEqual(
      Array.from(sectionToPixels(section, PALETTE.materials)),
    );
  });

  it('writes the window width on the line at the foot of the resist when there is one', () => {
    vi.stubGlobal('ImageData', FakeImageData);
    const view = deriveView(goToStep(createSession(1), 4));
    const { canvas, texts } = stage();
    drawCrossSection(
      canvas,
      {
        section: view.section,
        metrics: { topNm: view.exposure.printedNm, bottomNm: 0, cleared: false },
      },
      OPTIONS,
    );
    expect(texts.some((t) => t.startsWith('chân ≈'))).toBe(true);
    expect(texts).toContain('500 nm'); // the scale bar is there as in M04
    expect(texts.some((t) => t.startsWith('đáy'))).toBe(false); // no etch, no bottom line
  });

  it('draws no dimension line while nothing is open', () => {
    vi.stubGlobal('ImageData', FakeImageData);
    const { section } = deriveView(goToStep(createSession(1), 1));
    const { canvas, texts } = stage();
    drawCrossSection(
      canvas,
      { section, metrics: { topNm: 0, bottomNm: 0, cleared: false } },
      OPTIONS,
    );
    expect(texts).toEqual(['500 nm']);
  });
});
