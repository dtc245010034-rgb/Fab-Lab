// Builds the harness page into scripts/perf/out/dist. Not part of `npm run build`.
import { defineConfig } from 'vite';

export default defineConfig({
  root: import.meta.dirname,
  base: './',
  worker: { format: 'es' },
  build: { outDir: 'out/dist', emptyOutDir: true, target: 'es2023' },
});
