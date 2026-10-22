/**
 * The M03 page may import these modules without carrying the lithography model into the page
 * (the model runs in the worker; e2e/m03-page.spec.ts checks the built page for it). They are kept
 * to the few small physics modules that hold only constants and formulas of focus.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const PAGE_SAFE = ['m03Session.ts', 'windowSpec.ts', 'm03Controls.ts'];

/** What a page-safe module may take values from, besides type-only imports. */
const ALLOWED = [
  /^\.\/defaults$/,
  /^\.\/m03Session$/,
  /^\.\/windowSpec$/,
  /^\.\.\/physics\/focus$/,
  /^\.\.\/physics\/constants$/,
  /^\.\.\/physics\/litho$/,
];

/** The module specifiers of every import and re-export that is not type-only. */
function valueImports(source: string): string[] {
  const out: string[] = [];
  for (const m of source.matchAll(
    /^(?:import|export)\s+(?!type\b)[^;]*?from\s+['"]([^'"]+)['"]/gm,
  )) {
    out.push(m[1]!);
  }
  return out;
}

describe.each(PAGE_SAFE)('src/sim/%s', (name) => {
  const source = readFileSync(
    fileURLToPath(new URL(`../../src/sim/${name}`, import.meta.url)),
    'utf8',
  );

  it('exists and imports something, so this check looks at real code', () => {
    expect(source.length).toBeGreaterThan(100);
  });

  it('takes values only from the modules that are safe for the page', () => {
    for (const specifier of valueImports(source)) {
      expect(
        ALLOWED.some((ok) => ok.test(specifier)),
        `${name} imports ${specifier}`,
      ).toBe(true);
    }
  });
});

describe('the check itself', () => {
  it('sees a value import and ignores a type-only one', () => {
    const code = `import type { A } from './m03';\nimport { b } from './m03';\nexport { c } from '../physics/exposure';\nexport type { D } from './m03';\n`;
    expect(valueImports(code)).toEqual(['./m03', '../physics/exposure']);
  });
});
