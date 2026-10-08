import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const stylesDir = fileURLToPath(new URL('../../src/ui/styles', import.meta.url));

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
  ok: '#2f7d4c',
  warn: '#b9700d',
  bad: '#b3261e',
  // DESIGN.md prose: "Màn hình mặt cắt luôn nền tối #0f1320".
  screen: '#0f1320',
};

function parseCustomProperties(css: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of css.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    out.set(m[1]!, m[2]!.trim());
  }
  return out;
}

describe('design tokens (docs/DESIGN.md)', () => {
  const tokens = parseCustomProperties(readFileSync(join(stylesDir, 'tokens.css'), 'utf8'));

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
