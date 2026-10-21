import mdx from '@mdx-js/rollup';
import react from '@vitejs/plugin-react';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { defineConfig } from 'vitest/config';
import { keepWoff2Only } from './build/katexCss.ts';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    {
      name: 'katex-woff2-only',
      enforce: 'pre',
      transform(code, id) {
        if (id.endsWith('katex/dist/katex.min.css')) return keepWoff2Only(code);
      },
    },
    // Learner text is MDX; its maths is typeset by KaTeX here, while the site is built, so the
    // page carries KaTeX's markup and stylesheet but not its engine. A TeX error fails the build
    // (the default is to print the error in red on the page).
    {
      enforce: 'pre',
      ...mdx({
        format: 'mdx',
        remarkPlugins: [remarkMath],
        rehypePlugins: [[rehypeKatex, { throwOnError: true, strict: 'error' }]],
      }),
    },
    react(),
  ],
  build: {
    // Vite writes a small file into the stylesheet as base64. KaTeX_Size3 (3.6 KB) would be
    // carried by every visit to /m03, whether or not a big delimiter is ever drawn; as a file it
    // is fetched only when its glyphs are used, like the other nineteen.
    assetsInlineLimit: (file) => (file.includes('KaTeX_') ? false : undefined),
  },
  test: {
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    // Physics/sim tests run in node; UI tests opt in with `// @vitest-environment jsdom`.
    environment: 'node',
  },
});
