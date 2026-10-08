// @vitest-environment jsdom
/**
 * The renderer takes every colour from the design tokens (docs/DESIGN.md); a token it cannot read
 * as a hex colour is a bug to report, never a colour to guess.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  MATERIAL_TOKENS,
  paletteFromTokens,
  parseHexColor,
  readPalette,
  toCssHex,
  withMonospaceFallback,
} from '../../src/render/canvas2d/palette';

/** Same names and values as src/ui/styles/tokens.css (checked by tests/ui/tokens.test.ts). */
const TOKENS: Record<string, string> = {
  '--screen': '#0f1320',
  '--si': '#5b6b80',
  '--ox': '#b6a3dc',
  '--pr': '#c8432a',
  '--panel': '#f8eec6',
  '--navy': '#22305a',
  '--f-mono': "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace",
};

const reader = (over: Record<string, string> = {}) => {
  const all = { ...TOKENS, ...over };
  return (token: string) => all[token] ?? '';
};

describe('parseHexColor', () => {
  it.each([
    ['#5b6b80', [91, 107, 128]],
    ['#5B6B80', [91, 107, 128]],
    ['  #0f1320 ', [15, 19, 32]], // custom properties keep the whitespace they were written with
    ['#fff', [255, 255, 255]],
    ['#0a8', [0, 170, 136]],
  ])('reads %j', (text, rgb) => {
    expect(parseHexColor(text)).toEqual(rgb);
  });

  it.each([
    '',
    '   ',
    'rgb(91, 107, 128)',
    'red',
    '#12',
    '#12345',
    '#1234567',
    '#xyz123',
    '5b6b80',
  ])('rejects %j', (text) => {
    expect(() => parseHexColor(text)).toThrow(RangeError);
  });

  it('names what it was reading in the error', () => {
    expect(() => parseHexColor('red', 'token --si')).toThrow(/token --si/);
  });
});

describe('toCssHex', () => {
  it('writes a colour back as the 6-digit hex a canvas fillStyle accepts', () => {
    expect(toCssHex([91, 107, 128])).toBe('#5b6b80');
    expect(toCssHex([0, 0, 0])).toBe('#000000');
    expect(toCssHex([255, 255, 255])).toBe('#ffffff');
    expect(toCssHex([15, 19, 32])).toBe('#0f1320');
  });

  it('round-trips with parseHexColor', () => {
    for (const hex of ['#5b6b80', '#b6a3dc', '#c8432a', '#f8eec6', '#0f1320']) {
      expect(toCssHex(parseHexColor(hex))).toBe(hex);
    }
  });
});

describe('withMonospaceFallback', () => {
  it('leaves a stack that already ends in the generic family alone', () => {
    expect(withMonospaceFallback("'JetBrains Mono', monospace")).toBe(
      "'JetBrains Mono', monospace",
    );
  });

  it('appends the generic family when the stack has none, so ≈ and ₂ can fall back', () => {
    expect(withMonospaceFallback("'JetBrains Mono'")).toBe("'JetBrains Mono', monospace");
  });

  it('refuses an empty stack', () => {
    expect(() => withMonospaceFallback('  ')).toThrow(RangeError);
  });
});

describe('MATERIAL_TOKENS', () => {
  it('maps each material to its design token; etched-away cells show the screen colour', () => {
    expect(MATERIAL_TOKENS).toEqual({ air: '--screen', si: '--si', ox: '--ox', pr: '--pr' });
  });
});

describe('paletteFromTokens', () => {
  it('builds the palette from the tokens', () => {
    const p = paletteFromTokens(reader());
    expect(p.materials).toEqual({
      air: [15, 19, 32],
      si: [91, 107, 128],
      ox: [182, 163, 220],
      pr: [200, 67, 42],
    });
    expect(p.ink).toEqual([248, 238, 198]); // --panel: lines and label text on the dark screen
    expect(p.chip).toEqual([15, 19, 32]); // --screen: label background
    expect(p.surround).toEqual([34, 48, 90]); // --navy: the canvas outside the grid
    expect(p.fontStack).toBe(TOKENS['--f-mono']);
  });

  it.each(['--screen', '--si', '--ox', '--pr', '--panel', '--navy'])(
    'throws, naming %s, when it is not a hex colour',
    (token) => {
      expect(() => paletteFromTokens(reader({ [token]: 'rgb(1, 2, 3)' }))).toThrow(
        new RegExp(token),
      );
    },
  );

  it.each(['--screen', '--si', '--ox', '--pr', '--panel', '--navy'])(
    'throws, naming %s, when it is missing',
    (token) => {
      expect(() => paletteFromTokens(reader({ [token]: '' }))).toThrow(new RegExp(token));
    },
  );

  it('gives the canvas outside the grid a colour that is not air, nor any material', () => {
    const { materials, surround } = paletteFromTokens(reader());
    for (const [name, colour] of Object.entries(materials)) {
      expect(surround, `surround equals ${name}`).not.toEqual(colour);
    }
  });

  it('throws when the mono font stack is missing', () => {
    expect(() => paletteFromTokens(reader({ '--f-mono': '' }))).toThrow(/--f-mono/);
  });

  it('adds the monospace fallback to a stack that lacks it', () => {
    const p = paletteFromTokens(reader({ '--f-mono': "'JetBrains Mono'" }));
    expect(p.fontStack).toBe("'JetBrains Mono', monospace");
  });
});

describe('readPalette', () => {
  const style = document.createElement('style');
  afterEach(() => {
    style.remove();
    document.documentElement.removeAttribute('style');
  });

  const declare = (tokens: Record<string, string>) => {
    style.textContent = `:root { ${Object.entries(tokens)
      .map(([k, v]) => `${k}: ${v};`)
      .join(' ')} }`;
    document.head.append(style);
  };

  it('reads the computed custom properties of an element', () => {
    declare(TOKENS);
    const p = readPalette(document.documentElement);
    expect(p.materials.si).toEqual([91, 107, 128]);
    expect(p.materials.air).toEqual([15, 19, 32]);
    // jsdom re-serialises the quotes and spaces of the stack; only its shape matters here
    expect(p.fontStack).toMatch(/^["']JetBrains Mono["']\s*,/);
    expect(p.fontStack).toMatch(/monospace$/);
  });

  it('throws when a token in the page cannot be parsed as hex', () => {
    declare({ ...TOKENS, '--ox': 'rgb(182, 163, 220)' });
    expect(() => readPalette(document.documentElement)).toThrow(/--ox/);
  });

  it('throws when the tokens are not loaded at all', () => {
    expect(() => readPalette(document.documentElement)).toThrow(RangeError);
  });
});
