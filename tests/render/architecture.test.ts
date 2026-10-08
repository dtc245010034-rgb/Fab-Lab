/**
 * Rules for src/render/ (CLAUDE.md): it draws results, it never reaches up into the UI or React,
 * and every colour comes from the design tokens at run time. ESLint enforces the import rule too;
 * this test keeps the rule visible next to the code it protects.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const renderDir = fileURLToPath(new URL('../../src/render', import.meta.url));

const files = (readdirSync(renderDir, { recursive: true }) as string[])
  .filter((f) => /\.tsx?$/.test(f))
  .map((f) => ({
    name: f.replaceAll('\\', '/'),
    source: readFileSync(join(renderDir, f), 'utf8'),
  }));

/** Every module specifier in `import … from 'x'`, `import 'x'`, `export … from 'x'`, `import('x')`. */
function specifiers(source: string): string[] {
  const out: string[] = [];
  for (const m of source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) out.push(m[1]!);
  return out;
}

describe('src/render/', () => {
  it('has source files to check', () => {
    for (const name of ['pixels.ts', 'overlay.ts', 'palette.ts']) {
      expect(files.some((f) => f.name.endsWith(`canvas2d/${name}`))).toBe(true);
    }
  });

  it('never imports from ui, workers, modules or content', () => {
    const upward = /(^|\/)(ui|workers|modules|content)(\/|$)/;
    for (const f of files) {
      for (const s of specifiers(f.source)) {
        expect(s, `${f.name} imports ${s}`).not.toMatch(upward);
      }
    }
  });

  it('never imports React', () => {
    for (const f of files) {
      for (const s of specifiers(f.source)) {
        expect(s, `${f.name} imports ${s}`).not.toMatch(/^react(-dom)?(\/|$)/);
      }
    }
  });

  it('keeps raw colours out: hex, rgb() and hsl() literals belong in tokens.css only', () => {
    for (const f of files) {
      expect(f.source, `${f.name} contains a hex colour`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(f.source, `${f.name} contains an rgb()/hsl() colour`).not.toMatch(/\b(rgb|hsl)a?\(/);
    }
  });

  it('spots a forbidden import when there is one (the scan itself works)', () => {
    expect(specifiers("import X from '../../ui/Viewer';")).toEqual(['../../ui/Viewer']);
    expect(specifiers("export { a } from '../ui/x';")).toEqual(['../ui/x']);
    expect(specifiers("const m = await import('react');")).toEqual(['react']);
    expect(specifiers("import '../../content/vi/x';")).toEqual(['../../content/vi/x']);
  });
});
