/**
 * CI and e2e setup (S0.4). GitHub Actions only checks the code (lint, unit tests, build, e2e); it
 * never deploys and holds no Cloudflare secret, because Workers Builds deploys (see README and
 * tests/deploy/config.test.ts). These pin that promise, and that `npm run e2e` really tests the
 * production build rather than a stale one.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = (file: string) => fileURLToPath(new URL(`../../${file}`, import.meta.url));
const read = (file: string) => readFileSync(root(file), 'utf8');

const workflowPath = '.github/workflows/ci.yml';
const workflow = existsSync(root(workflowPath)) ? read(workflowPath) : '';
/** The workflow without its comment lines: the header comment explains why it does not deploy. */
const code = workflow
  .split('\n')
  .filter((line) => !line.trim().startsWith('#'))
  .join('\n');
const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };

/** The `run:` commands of the workflow, in order. */
const commands = [...workflow.matchAll(/^\s*-?\s*run:\s*(.+)$/gm)].map((m) => m[1]!.trim());

describe('.github/workflows/ci.yml', () => {
  it('exists', () => {
    expect(existsSync(root(workflowPath))).toBe(true);
  });

  it('runs on every push, so a feature branch is checked before it is merged', () => {
    expect(workflow).toMatch(/^on:\s*\n\s+push:/m);
  });

  it('installs from the lockfile, then lints, tests, builds and runs e2e, in that order', () => {
    const steps = ['npm ci', 'npm run lint', 'npm test', 'npm run build', 'npx playwright test'];
    const at = steps.map((s) => commands.indexOf(s));
    steps.forEach((s, i) =>
      expect(at[i], `"${s}" is missing from the run steps`).toBeGreaterThan(-1),
    );
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it('installs the Chromium that Playwright drives, with its system libraries', () => {
    expect(commands).toContain('npx playwright install --with-deps chromium');
    const install = commands.indexOf('npx playwright install --with-deps chromium');
    expect(install).toBeLessThan(commands.indexOf('npx playwright test'));
  });

  it('runs e2e on the output of its own build step, not by building a second time', () => {
    expect(commands).not.toContain('npm run e2e');
  });

  it('never deploys and needs no secret', () => {
    expect(code).not.toMatch(/wrangler/i);
    expect(code).not.toMatch(/\bdeploy/i);
    expect(code).not.toMatch(/cloudflare/i);
    expect(code).not.toMatch(/secrets\./);
    expect(code).not.toMatch(/pull_request_target/);
  });

  it('asks for read-only access to the repository, and nothing more', () => {
    expect(code).toMatch(/^permissions:\s*\n\s+contents:\s*read\s*$/m);
    expect(code).not.toMatch(/:\s*write\b/);
  });

  it('cancels a run that a newer push to the same branch has made obsolete', () => {
    expect(workflow).toMatch(/concurrency:/);
    expect(workflow).toMatch(/cancel-in-progress:\s*true/);
  });

  it('keeps the Playwright report when e2e fails', () => {
    expect(workflow).toMatch(/if:\s*failure\(\)/);
    expect(workflow).toMatch(/playwright-report/);
  });
});

describe('npm run e2e', () => {
  it('builds first, so it never tests a stale dist/', () => {
    expect(pkg.scripts.e2e).toBe('npm run build && playwright test');
  });
});

describe('playwright.config.ts', () => {
  const config = read('playwright.config.ts');

  it('serves the production build with `vite preview`, on a port it insists on', () => {
    expect(config).toMatch(/npm run preview/);
    expect(config).toMatch(/--strictPort/);
  });

  it('never reuses a server that happens to be running (it could be serving an old build)', () => {
    expect(config).toMatch(/reuseExistingServer:\s*false/);
  });

  it('does not retry: a test that passes on the second try is a flaky test', () => {
    expect(config).toMatch(/retries:\s*0/);
  });
});

describe('e2e/', () => {
  it('has one smoke test file', () => {
    expect(existsSync(root('e2e/smoke.spec.ts'))).toBe(true);
  });

  it('keeps the reports out of git', () => {
    const ignored = read('.gitignore').split(/\r?\n/);
    expect(ignored).toContain('playwright-report/');
    expect(ignored).toContain('test-results/');
  });
});
