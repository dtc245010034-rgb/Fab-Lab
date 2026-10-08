import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const srcDir = fileURLToPath(new URL('../../src', import.meta.url));
const stylesDir = join(srcDir, 'ui', 'styles');

/** Token names and values exactly as written in docs/DESIGN.md ("Tokens (giữ nguyên tên)"). */
const DESIGN_TOKENS: Record<string, string> = {
  bg: '#efdb98',
  panel: '#f8eec6',
  'panel-2': '#f3e4ad',
  ink: '#1c2230',
  muted: '#5f5a45',
  line: '#d4bf75',
  navy: '#22305a',
  si: '#5b6b80',
  ox: '#b6a3dc',
  pr: '#c8432a',
  // status: borders, dots, icons
  ok: '#2f7d4c',
  warn: '#9a5c00',
  bad: '#b3261e',
  // status: text (bad uses --bad)
  'ok-ink': '#1f5c37',
  'warn-ink': '#844c00',
  screen: '#0f1320',
};

function parseCustomProperties(css: string): Map<string, string> {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = new Map<string, string>();
  for (const m of withoutComments.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    out.set(m[1]!, m[2]!.trim());
  }
  return out;
}

/** WCAG 2.x relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const tokens = parseCustomProperties(readFileSync(join(stylesDir, 'tokens.css'), 'utf8'));

function token(name: string): string {
  const value = tokens.get(name);
  if (!value) throw new Error(`token --${name} is missing`);
  return value.toLowerCase();
}

describe('design tokens (docs/DESIGN.md)', () => {
  it.each(Object.entries(DESIGN_TOKENS))('--%s is %s', (name, value) => {
    expect(tokens.get(name)?.toLowerCase()).toBe(value);
  });

  it('declares the three font stacks with the DESIGN.md families first', () => {
    expect(tokens.get('f-display')).toMatch(/^["']Saira Condensed["']/);
    expect(tokens.get('f-body')).toMatch(/^["']Be Vietnam Pro["']/);
    expect(tokens.get('f-mono')).toMatch(/^["']JetBrains Mono["']/);
  });

  it('keeps raw colours out of every stylesheet except tokens.css', () => {
    const others = readdirSync(stylesDir).filter((f) => f.endsWith('.css') && f !== 'tokens.css');
    expect(others.length).toBeGreaterThan(0);
    for (const file of others) {
      const css = readFileSync(join(stylesDir, file), 'utf8');
      expect(css, `${file} contains a raw hex colour`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(css, `${file} contains a raw rgb()/hsl() colour`).not.toMatch(/\b(rgb|hsl)a?\(/);
    }
  });
});

describe('status colour rules (docs/DESIGN.md, "Quy tắc màu trạng thái")', () => {
  const surfaces = ['bg', 'panel', 'panel-2'] as const;

  const textTokens = ['ink', 'muted', 'navy', 'ok-ink', 'warn-ink', 'bad'] as const;
  const textCases = textTokens.flatMap((fg) => surfaces.map((bg) => [fg, bg] as const));
  it.each(textCases)('text --%s on --%s has contrast >= 4.5 (AA)', (fg, bg) => {
    expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it('button text (--panel) on --navy has contrast >= 4.5 (AA)', () => {
    expect(contrast(token('panel'), token('navy'))).toBeGreaterThanOrEqual(4.5);
  });

  // --pr is the focus-ring colour, so it counts as a non-text indicator too.
  const indicatorTokens = ['ok', 'warn', 'bad', 'pr'] as const;
  const indicatorCases = indicatorTokens.flatMap((fg) => surfaces.map((bg) => [fg, bg] as const));
  it.each(indicatorCases)('border/dot/icon --%s on --%s has contrast >= 3', (fg, bg) => {
    expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(3);
  });

  it('never uses --ok or --warn as a text colour in src/ (use --ok-ink, --warn-ink or --bad)', () => {
    const files = (readdirSync(srcDir, { recursive: true }) as string[])
      .filter((f) => /\.(css|tsx?)$/.test(f))
      .filter((f) => !/(^|[\\/])tokens\.css$/.test(f));
    expect(files.length).toBeGreaterThan(0);
    // `color:` not preceded by "-" or a word char, so border-color / outline-color stay allowed.
    const textColourOfStatus = /(?<![-\w])color\s*:\s*['"]?var\(\s*--(ok|warn)\s*\)/;
    for (const file of files) {
      const source = readFileSync(join(srcDir, file), 'utf8');
      expect(source, `${file} uses --ok/--warn as text colour`).not.toMatch(textColourOfStatus);
    }
  });
});
