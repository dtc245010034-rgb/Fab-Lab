// Drives the perf harness page in Chrome and writes raw samples (and optionally a Chrome trace).
//
//   node scripts/perf/run.mjs <label> [--where=worker|main] [--rate=1] [--loads=4] [--runs=30]
//        [--mode=bench|learner] [--warm=1|0] [--trace] [--browser=chrome|chromium] [--port=4180]
//        [--order=BCBCB] [--idle=3000]
//
// Build the page first: npx vite build --config scripts/perf/vite.config.mjs
// Output goes to scripts/perf/out/: results-<label>.json, and with --trace trace-<label>-<load>.json.
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { extname, join } from 'node:path';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [key, value = '1'] = a.slice(2).split('=');
      return [key, value];
    }),
);
const label = process.argv[2];
if (!label || label.startsWith('--')) {
  console.error(
    'usage: node scripts/perf/run.mjs <label> [options]  (see the header of this file)',
  );
  process.exit(1);
}
const where = args.where ?? 'worker';
const rate = Number(args.rate ?? 1);
const loads = Number(args.loads ?? 4);
const mode = args.mode ?? 'bench';
const warm = args.warm ?? '1';
const runsPerCase = Number(args.runs ?? 30);
const port = Number(args.port ?? 4180);

const out = join(import.meta.dirname, 'out');
const root = join(out, 'dist');
if (!existsSync(join(root, 'index.html'))) {
  console.error('Build the page first: npx vite build --config scripts/perf/vite.config.mjs');
  process.exit(1);
}
mkdirSync(out, { recursive: true });

// A static server for the built page (Vite's preview server would do, but this has no dependencies).
const mime = { '.html': 'text/html', '.js': 'text/javascript' };
const server = http.createServer((req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  const file = join(root, path === '/' ? 'index.html' : path);
  try {
    const body = readFileSync(file);
    res.writeHead(200, { 'content-type': mime[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(port, 'localhost', resolve));

// The same three recipes as src/sim/cases.ts (cases A, B, C of docs/modules/m04-etch.md).
const CASES = {
  A: {
    litho: { spinRpm: 3000, source: 'i', designNm: 800, dose: 1 },
    etch: { mode: 'wet', etchant: 'boe6', timeMin: 3.3 },
  },
  B: {
    litho: { spinRpm: 3000, source: 'i', designNm: 800, dose: 1 },
    etch: { mode: 'dry', powerW: 200, pressureMTorr: 30, timeMin: 4.6 },
  },
  C: {
    litho: { spinRpm: 3000, source: 'i', designNm: 400, dose: 1 },
    etch: { mode: 'dry', powerW: 80, pressureMTorr: 180, timeMin: 9 },
  },
};

const browser = await chromium.launch(
  args.browser === 'chromium' ? { headless: true } : { channel: 'chrome', headless: true },
);
const results = { label, version: browser.version(), rate, mode, warm, where, loads: [] };

for (let load = 1; load <= loads; load++) {
  // A fresh context per load: no HTTP cache, no code cache, so each load is a first visit.
  const context = await browser.newContext();
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  // Only the page's main thread is slowed down; Chrome refuses this for workers.
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  if (args.trace) {
    await browser.startTracing(page, {
      categories: [
        'devtools.timeline',
        'v8',
        'blink.user_timing',
        'disabled-by-default-v8.gc',
        'toplevel',
      ],
    });
  }
  await page.goto(`http://localhost:${port}/?warm=${warm}&where=${where}`);

  let data;
  if (mode === 'bench') {
    data = await page.evaluate((runs) => window.measure.bench(runs), runsPerCase);
  } else {
    // learner: the default recipe at load (what the Lab asks for), a pause, then one change at a time
    const calls = [{ call: 1, ...(await page.evaluate((r) => window.measure.run(r), CASES.B)) }];
    await page.waitForTimeout(Number(args.idle ?? 3000));
    const order = (args.order ?? 'BCBCB').split('');
    for (let i = 0; i < order.length; i++) {
      const timing = await page.evaluate((r) => window.measure.run(r), CASES[order[i]]);
      calls.push({ call: i + 2, caseId: order[i], ...timing });
      await page.waitForTimeout(300);
    }
    data = { calls };
  }

  if (args.trace) {
    writeFileSync(join(out, `trace-${label}-${load}.json`), await browser.stopTracing());
  }
  results.loads.push(data);
  await context.close();
  console.log(`load ${load}/${loads} done`);
}

writeFileSync(join(out, `results-${label}.json`), JSON.stringify(results));
await browser.close();
server.close();
console.log(
  `chrome ${results.version}, ${where}, ${rate}x, ${loads} loads -> out/results-${label}.json`,
);
