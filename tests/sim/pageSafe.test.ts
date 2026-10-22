/**
 * The M03 page may import these modules without carrying the lithography model into the page
 * (the model runs in the worker; e2e/m03-page.spec.ts checks the built page for it). They are kept
 * to the few small physics modules that hold only constants and formulas of focus.
 */
import { readdirSync, readFileSync } from 'node:fs';
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

/** The modules that hold the lithography model: a value import of any of them carries it into the page. */
const MODEL = /(?:^|\/)(?:sim\/m03|physics\/(?:exposure|aerial|special|processWindow|overlay))$/;

/** Where the copy and the page of M03 live; they may name the model's types and never its values. */
const PAGE_DIRS = ['src/content/vi/m03', 'src/modules/m03-lithography'];
const PAGE_FILES = PAGE_DIRS.flatMap((dir) =>
  readdirSync(fileURLToPath(new URL(`../../${dir}`, import.meta.url)))
    .filter((f) => /\.(ts|tsx)$/.test(f))
    .map((f) => `${dir}/${f}`),
);

describe.each(PAGE_FILES)('%s', (file) => {
  const source = readFileSync(fileURLToPath(new URL(`../../${file}`, import.meta.url)), 'utf8');

  it('takes no value from the lithography model: the page must not carry it', () => {
    // `../../sim/m03` resolves from the file's own folder; compare the end of the specifier
    for (const specifier of valueImports(source)) {
      expect(MODEL.test(specifier), `${file} imports ${specifier}`).toBe(false);
    }
  });
});

describe('the check on the page files', () => {
  it('finds files to look at, copy and page', () => {
    expect(PAGE_FILES.some((f) => f.endsWith('reasons.ts'))).toBe(true);
    expect(PAGE_FILES.some((f) => f.endsWith('M03Page.tsx'))).toBe(true);
  });

  it('refuses a value import of the model and lets a type import through', () => {
    expect(MODEL.test('../../sim/m03')).toBe(true);
    expect(MODEL.test('../../physics/exposure')).toBe(true);
    expect(MODEL.test('../../sim/m03Session')).toBe(false);
    expect(MODEL.test('../../physics/focus')).toBe(false);
    expect(valueImports("import type { Cause } from '../../sim/m03';")).toEqual([]);
  });
});

describe('the check itself', () => {
  it('sees a value import and ignores a type-only one', () => {
    const code = `import type { A } from './m03';\nimport { b } from './m03';\nexport { c } from '../physics/exposure';\nexport type { D } from './m03';\n`;
    expect(valueImports(code)).toEqual(['./m03', '../physics/exposure']);
  });
});
