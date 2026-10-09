/**
 * Rules for src/workers/ (CLAUDE.md): it exposes sim/ to the page and never imports React or
 * reaches into the UI or the renderer. ESLint enforces the import rule too; this test keeps the
 * rule visible next to the code it protects.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const workersDir = fileURLToPath(new URL('../../src/workers', import.meta.url));

const files = (readdirSync(workersDir, { recursive: true }) as string[])
  .filter((f) => /\.tsx?$/.test(f))
  .map((f) => ({
    name: f.replaceAll('\\', '/'),
    source: readFileSync(join(workersDir, f), 'utf8'),
  }));

/** Every module specifier in `import … from 'x'`, `import 'x'`, `export … from 'x'`, `import('x')`. */
function specifiers(source: string): string[] {
  const out: string[] = [];
  for (const m of source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) out.push(m[1]!);
  return out;
}

describe('src/workers/', () => {
  it('has source files to check', () => {
    for (const name of ['sim.worker.ts', 'simService.ts', 'simClient.ts', 'spawn.ts']) {
      expect(files.some((f) => f.name === name)).toBe(true);
    }
  });

  it('never imports from ui, render, modules or content', () => {
    const upward = /(^|\/)(ui|render|modules|content)(\/|$)/;
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

  it('keeps the page-only API (window, document) out of the worker file', () => {
    const worker = files.find((f) => f.name === 'sim.worker.ts')!;
    expect(worker.source).not.toMatch(/\b(window|document)\b/);
  });

  it('spots a forbidden import when there is one (the scan itself works)', () => {
    expect(specifiers("import X from '../ui/Viewer';")).toEqual(['../ui/Viewer']);
    expect(specifiers("export { a } from '../render/canvas2d/pixels';")).toEqual([
      '../render/canvas2d/pixels',
    ]);
    expect(specifiers("const m = await import('react');")).toEqual(['react']);
  });
});
