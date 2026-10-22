/**
 * What `drawCrossSection` does for the M04 etch lab, recorded call by call on a stand-in canvas and
 * fingerprinted. M03 draws through the same function (S1.1 step 3b-1), and the M04 path must stay
 * bit-identical: this test was written, and its fingerprints taken, before that change was made.
 * A fingerprint is a hash of every drawing call in order, the pixels handed to ImageData included.
 */
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { drawCrossSection } from '../../src/render/canvas2d/crossSection';
import type { RenderPalette } from '../../src/render/canvas2d/palette';
import { DEFAULT_RECIPE } from '../../src/sim/defaults';
import { M04_CASES } from '../../src/sim/cases';
import { runRecipe } from '../../src/sim/recipe';

const PALETTE: RenderPalette = {
  materials: { air: [1, 2, 3], si: [10, 20, 30], ox: [40, 50, 60], pr: [70, 80, 90] },
  ink: [200, 201, 202],
  chip: [5, 6, 7],
  surround: [100, 110, 120],
  fontStack: '"JetBrains Mono", monospace',
};

type Call = [name: string, ...args: unknown[]];

/** A canvas whose 2-D context writes every call and every assignment into `log`. */
function recordingCanvas(log: Call[]) {
  const record = (target: string): CanvasRenderingContext2D =>
    new Proxy(
      {},
      {
        get(_t, name: string) {
          if (name === 'measureText') {
            return (text: string) => {
              log.push([`${target}.measureText`, text]);
              return { width: text.length * 7 };
            };
          }
          return (...args: unknown[]) => {
            log.push([`${target}.${name}`, ...args.map((a) => hashable(a))]);
          };
        },
        set(_t, name: string, value: unknown) {
          log.push([`${target}.${name}=`, value]);
          return true;
        },
      },
    ) as CanvasRenderingContext2D;

  const bufferCtx = record('buffer');
  const ctx = record('ctx');
  const buffer = { width: 0, height: 0, getContext: () => bufferCtx };
  const canvas = {
    width: 0,
    height: 0,
    style: {} as Record<string, string>,
    getContext: () => ctx,
    ownerDocument: { createElement: () => buffer },
  };
  return { canvas: canvas as unknown as HTMLCanvasElement, buffer, host: canvas };
}

/** ImageData and the buffer canvas stand for themselves in the log; pixels are hashed. */
function hashable(value: unknown): unknown {
  if (value && typeof value === 'object' && 'data' in value && 'width' in value) {
    const image = value as { data: Uint8ClampedArray; width: number; height: number };
    const digest = createHash('sha256').update(image.data).digest('hex');
    return { imageData: [image.width, image.height, digest] };
  }
  if (value && typeof value === 'object' && 'getContext' in value) return 'buffer-canvas';
  return value;
}

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

function fingerprint(
  recipe = DEFAULT_RECIPE,
  options: { availableCssWidth: number; dpr: number },
): { hash: string; calls: number } {
  vi.stubGlobal('ImageData', FakeImageData);
  const log: Call[] = [];
  const { canvas, host } = recordingCanvas(log);
  const result = runRecipe(recipe);
  const drawn = drawCrossSection(
    canvas,
    {
      section: result.section,
      field: result.field,
      timeMin: recipe.etch.timeMin,
      metrics: result.metrics,
    },
    { palette: PALETTE, labels: { top: 'đỉnh', bottom: 'đáy' }, ...options },
  );
  log.push(['result', drawn, host.width, host.height, host.style]);
  const hash = createHash('sha256').update(JSON.stringify(log)).digest('hex');
  return { hash, calls: log.length };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Fingerprints taken on the code as it was before M03 touched this file. */
const GOLDEN = {
  'B at 380 css px, dpr 2': 'daa84f39f002bfc217c9600ea5498ec6c43077e5dfee30e2fd70eb9f5f29b2f6',
  'B at 700 css px, dpr 1': '8bdaa8ba064880b5db44055e05aec40a7915e9562b6ea48cf7dc27ef15340b01',
  'A at 380 css px, dpr 3': '2f61a80be102ee5169046ac3e838210d50e590d73811f545bf0ed0a2da5f0679',
  'C at 520 css px, dpr 1.25': 'c6d389183520e80fc77d775c7604bc0b3d95d2c7dab8f6db2924d3dad8b01ad1',
} as const;

describe('drawCrossSection for the M04 etch lab', () => {
  const case_ = (id: 'A' | 'B' | 'C') => M04_CASES.find((c) => c.id === id)!.recipe;

  it.each([
    ['B at 380 css px, dpr 2', case_('B'), { availableCssWidth: 380, dpr: 2 }],
    ['B at 700 css px, dpr 1', case_('B'), { availableCssWidth: 700, dpr: 1 }],
    ['A at 380 css px, dpr 3', case_('A'), { availableCssWidth: 380, dpr: 3 }],
    ['C at 520 css px, dpr 1.25', case_('C'), { availableCssWidth: 520, dpr: 1.25 }],
  ] as const)('%s draws exactly what it drew before', (name, recipe, options) => {
    const { hash, calls } = fingerprint(recipe, options);
    expect(calls, 'the recording is not empty').toBeGreaterThan(30);
    expect(hash, `fingerprint of “${name}”`).toBe(GOLDEN[name]);
  });
});
