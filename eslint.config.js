import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Dependency direction (CLAUDE.md): ui → sim → physics, never the reverse.
 * Each block lists what a layer must NOT import; content-source/ is never imported anywhere.
 */
const layer = (...groups) => ({
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        {
          group: ['**/content-source', '**/content-source/**'],
          message: 'content-source/ is raw study material; never import it into src/.',
        },
        ...groups,
      ],
    },
  ],
});

const dirs = (...names) => names.flatMap((n) => [`**/${n}`, `**/${n}/**`]);

const noReact = {
  group: ['react', 'react/*', 'react-dom', 'react-dom/*'],
  message: 'This layer must stay free of React.',
};

export default tseslint.config(
  {
    ignores: [
      'dist',
      'coverage',
      'node_modules',
      'docs',
      'content-source',
      'reference',
      'playwright-report',
      'test-results',
      'scripts/perf/out',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommended, jsxA11y.flatConfigs.recommended],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      ...layer(),
    },
  },
  {
    files: ['src/physics/**'],
    rules: layer(
      {
        group: dirs('sim', 'ui', 'render', 'workers', 'modules', 'content'),
        message: 'physics/ is the bottom layer: no imports from sim, ui, render, workers, modules.',
      },
      noReact,
    ),
  },
  {
    files: ['src/sim/**'],
    rules: layer(
      {
        group: dirs('ui', 'render', 'workers', 'modules', 'content'),
        message: 'sim/ may only depend on physics/.',
      },
      noReact,
    ),
  },
  {
    files: ['src/render/**'],
    rules: layer(
      {
        group: dirs('ui', 'workers', 'modules', 'content'),
        message: 'render/ draws results: no imports from ui, workers, modules, content.',
      },
      noReact,
    ),
  },
  {
    files: ['src/workers/**'],
    rules: layer(
      {
        group: dirs('ui', 'render', 'modules', 'content'),
        message: 'workers/ exposes sim/ to the page: no imports from ui, render, modules, content.',
      },
      noReact,
    ),
  },
  {
    files: ['*.config.{js,ts}', 'vite.config.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    // Node scripts. scripts/perf/run.mjs also passes callbacks to page.evaluate, which run in the browser.
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  prettier,
);
