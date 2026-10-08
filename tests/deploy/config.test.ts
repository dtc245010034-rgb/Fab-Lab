/**
 * Deploy setup (S0.3): Cloudflare Workers static assets, built and deployed by Workers Builds.
 * These pin what the setup promises: the SPA asset config, an exactly pinned wrangler (Workers
 * Builds uses the version in package.json), no secrets in the repo, and a README whose main path
 * is Workers Builds.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = (file: string) => fileURLToPath(new URL(`../../${file}`, import.meta.url));
const read = (file: string) => readFileSync(root(file), 'utf8');

/** wrangler.jsonc without its comments (whole-line `//` and block comments; `//` inside strings stays). */
function parseJsonc(text: string): Record<string, unknown> {
  const stripped = text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')
    .replace(/,(\s*[}\]])/g, '$1'); // trailing commas are allowed in jsonc
  return JSON.parse(stripped) as Record<string, unknown>;
}

const wrangler = parseJsonc(read('wrangler.jsonc'));
const pkg = JSON.parse(read('package.json')) as {
  scripts: Record<string, string>;
  devDependencies: Record<string, string>;
};

describe('wrangler.jsonc', () => {
  it('serves dist/ as a single-page app', () => {
    expect(wrangler.assets).toEqual({
      directory: './dist',
      not_found_handling: 'single-page-application',
    });
  });

  it('is assets only: no Worker script, so no backend before Phase 4', () => {
    expect(wrangler).not.toHaveProperty('main');
    expect(wrangler).not.toHaveProperty('d1_databases');
    expect(wrangler).not.toHaveProperty('kv_namespaces');
  });

  it('names the Worker fab-lab (the dashboard name must match) and dates the runtime', () => {
    expect(wrangler.name).toBe('fab-lab');
    expect(wrangler.compatibility_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('points at the folder Vite builds into', () => {
    // vite.config.ts sets no outDir, so Vite's default `dist` applies
    expect(read('vite.config.ts')).not.toMatch(/outDir/);
  });
});

describe('package.json', () => {
  it('pins wrangler to exactly 4.148.0, no range', () => {
    expect(pkg.devDependencies.wrangler).toBe('4.148.0');
  });

  it('has a deploy script for the command-line fallback: build, then wrangler deploy', () => {
    expect(pkg.scripts.deploy).toBe('npm run build && wrangler deploy');
  });
});

describe('secrets stay out of the repo', () => {
  const ignored = read('.gitignore').split(/\r?\n/);

  it('ignores wrangler state and local variables', () => {
    expect(ignored).toContain('.wrangler/');
    expect(ignored).toContain('.dev.vars*');
  });

  it('has no token-like assignment in the config or the README', () => {
    const assignment = /(TOKEN|SECRET|API_KEY|PASSWORD)\s*[=:]\s*['"]?[A-Za-z0-9_-]{16,}/i;
    for (const file of ['wrangler.jsonc', 'README.md', 'package.json']) {
      expect(read(file), `${file} looks like it holds a secret`).not.toMatch(assignment);
    }
  });
});

describe('README.md deploy section', () => {
  const readme = read('README.md');

  it('makes Workers Builds the main path, before the command-line fallback', () => {
    const main = readme.indexOf('Workers Builds');
    const cli = readme.indexOf('wrangler login');
    expect(main).toBeGreaterThanOrEqual(0);
    expect(cli).toBeGreaterThan(main);
  });

  it('gives the exact build and deploy commands', () => {
    expect(readme).toContain('npm ci && npm test && npm run build');
    expect(readme).toContain('npx wrangler deploy');
  });

  it('says the GitHub Actions of S0.4 do not deploy', () => {
    expect(readme).toMatch(/Actions[^\n]*(không|KHÔNG)[^\n]*deploy/i);
  });

  it('says the Worker name on the dashboard must be fab-lab', () => {
    expect(readme).toMatch(/fab-lab/);
    expect(readme).toMatch(/tên Worker/i);
  });
});
