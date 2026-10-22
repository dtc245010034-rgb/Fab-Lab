/**
 * Git hooks and the status file (S1.1 housekeeping). The hooks are installed by simple-git-hooks
 * from package.json (`prepare`), so the config is what we can check: pre-commit type-checks and
 * lints, pre-push runs the unit tests, and neither runs e2e. STATUS.md is read at the start of
 * every session, so it must stay short: at most 150 lines of at most 300 characters.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (file: string) =>
  readFileSync(fileURLToPath(new URL(`../../${file}`, import.meta.url)), 'utf8');

const pkg = JSON.parse(read('package.json')) as {
  scripts: Record<string, string>;
  devDependencies: Record<string, string>;
  'simple-git-hooks'?: Record<string, string>;
};

describe('git hooks', () => {
  it('are installed by simple-git-hooks on npm install', () => {
    expect(pkg.devDependencies['simple-git-hooks']).toBeTruthy();
    expect(pkg.scripts.prepare).toBe('simple-git-hooks');
  });

  it('pre-commit type-checks and lints', () => {
    const cmd = pkg['simple-git-hooks']?.['pre-commit'] ?? '';
    expect(cmd).toContain('tsc -b');
    expect(cmd).toContain('npm run lint');
  });

  it('pre-push runs the unit tests', () => {
    expect(pkg['simple-git-hooks']?.['pre-push']).toContain('npm test');
  });

  it('never run e2e', () => {
    for (const cmd of Object.values(pkg['simple-git-hooks'] ?? {})) {
      expect(cmd).not.toMatch(/e2e|playwright/);
    }
  });
});

describe('docs/STATUS.md', () => {
  const lines = read('docs/STATUS.md').split('\n');
  if (lines[lines.length - 1] === '') lines.pop();

  it('has at most 150 lines', () => {
    expect(lines.length).toBeLessThanOrEqual(150);
  });

  it('has no line over 300 characters', () => {
    const long = lines
      .map((line, i) => ({ n: i + 1, length: [...line].length }))
      .filter((l) => l.length > 300);
    expect(long).toEqual([]);
  });
});
