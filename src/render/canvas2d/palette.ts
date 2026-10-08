/**
 * Colours of the cross-section, read from the design tokens (docs/DESIGN.md) at draw time so the
 * canvas and the page can never drift apart. This is the only place that turns token text into
 * numbers; a token that is not a hex colour is an error, never a guess.
 */

export type Rgb = readonly [red: number, green: number, blue: number];

/** One colour per material code; etched-away cells use `air`. */
export interface MaterialPalette {
  air: Rgb;
  si: Rgb;
  ox: Rgb;
  pr: Rgb;
}

export interface RenderPalette {
  materials: MaterialPalette;
  /** Lines and label text drawn over the dark screen. */
  ink: Rgb;
  /** Background of a label chip, so text stays readable over any material. */
  chip: Rgb;
  /** Font stack of the numbers and units; always ends in the generic `monospace`. */
  fontStack: string;
}

/** Design token behind each material colour. The page legend uses the same names. */
export const MATERIAL_TOKENS = {
  air: '--screen',
  si: '--si',
  ox: '--ox',
  pr: '--pr',
} as const;

const INK_TOKEN = '--panel';
const CHIP_TOKEN = '--screen';
const FONT_TOKEN = '--f-mono';

/** `#rgb` or `#rrggbb`, with the whitespace a custom property keeps from its source. */
export function parseHexColor(text: string, what = 'colour'): Rgb {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text.trim())?.[1];
  if (!hex) throw new RangeError(`${what} must be a #rgb or #rrggbb colour, got "${text.trim()}"`);
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** The 6-digit hex text a canvas `fillStyle` takes; the inverse of `parseHexColor`. */
export function toCssHex([red, green, blue]: Rgb): string {
  const byte = (v: number) => v.toString(16).padStart(2, '0');
  return `#${byte(red)}${byte(green)}${byte(blue)}`;
}

/**
 * Glyphs such as ≈ and ₂ are not in the self-hosted font subsets, so the browser takes them from
 * another font; the stack must therefore end in a generic family that always exists.
 */
export function withMonospaceFallback(stack: string): string {
  const trimmed = stack.trim();
  if (!trimmed) throw new RangeError('font stack must not be empty');
  return /(^|,)\s*monospace\s*$/i.test(trimmed) ? trimmed : `${trimmed}, monospace`;
}

/** `read` returns the raw text of a custom property, or "" when it is not set. */
export function paletteFromTokens(read: (token: string) => string): RenderPalette {
  const colour = (token: string) => parseHexColor(read(token), `token ${token}`);
  const fontText = read(FONT_TOKEN);
  if (!fontText.trim()) throw new RangeError(`token ${FONT_TOKEN} is not set`);
  return {
    materials: {
      air: colour(MATERIAL_TOKENS.air),
      si: colour(MATERIAL_TOKENS.si),
      ox: colour(MATERIAL_TOKENS.ox),
      pr: colour(MATERIAL_TOKENS.pr),
    },
    ink: colour(INK_TOKEN),
    chip: colour(CHIP_TOKEN),
    fontStack: withMonospaceFallback(fontText),
  };
}

export function readPalette(el: Element): RenderPalette {
  const style = getComputedStyle(el);
  return paletteFromTokens((token) => style.getPropertyValue(token));
}
