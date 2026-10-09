// node scripts/perf/inspect-gc.mjs <trace.json>
// Lists the MajorGC events on the run thread (type, duration, the run they fall in or "between
// runs") and, for the slowest runs, the GC events that led into them.
import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/perf/inspect-gc.mjs <trace.json>');
  process.exit(1);
}
const trace = JSON.parse(readFileSync(file, 'utf8'));
const events = trace.traceEvents ?? trace;
const starts = new Map();
const ends = new Map();
let tid;
let pid;
for (const e of events) {
  const m = /^run-(start|end)-(\d+)$/.exec(e.name);
  if (m) {
    tid = e.tid;
    pid = e.pid;
    (m[1] === 'start' ? starts : ends).set(Number(m[2]), e.ts);
  }
}
const mine = (e) => e.pid === pid && e.tid === tid;
const runs = [...starts]
  .map(([i, s]) => ({ i, s, e: ends.get(i), ms: (ends.get(i) - s) / 1000 }))
  .filter((r) => r.e);
const sorted = runs.filter((r) => r.i > 9).sort((a, b) => a.ms - b.ms);
const median = sorted[sorted.length >> 1].ms;
const t0 = starts.get(1);
const rel = (ts) => ((ts - t0) / 1000).toFixed(1);
const runAt = (ts) => runs.find((r) => ts >= r.s && ts < r.e);

const major = events.filter((e) => mine(e) && e.ph === 'X' && e.name === 'MajorGC');
console.log(
  `thread ${pid}:${tid}; ${runs.length} runs; median (run > 9) ${median.toFixed(2)} ms; MajorGC: ${major.length}`,
);
for (const m of major) {
  const r = runAt(m.ts);
  console.log(
    `  MajorGC @${rel(m.ts)} ms  ${(m.dur / 1000).toFixed(2)} ms  ${m.args?.type}  ${r ? `inside run #${r.i} (${r.ms.toFixed(2)} ms)` : 'between runs'}`,
  );
}

const gcAll = events
  .filter((e) => mine(e) && e.ph === 'X' && /^(MinorGC|MajorGC)$/.test(e.name))
  .sort((a, b) => a.ts - b.ts);
const slowest = runs
  .filter((x) => x.i > 9 && x.ms > 3 * median)
  .sort((a, b) => b.ms - a.ms)
  .slice(0, 3);
for (const r of slowest) {
  console.log(
    `--- run #${r.i} ${r.ms.toFixed(2)} ms (starts @${rel(r.s)}); GC events from 60 ms before to its end:`,
  );
  const near = gcAll.filter((g) => g.ts > r.s - 60000 && g.ts < r.e);
  const shown = near.length > 14 ? [...near.slice(0, 6), null, ...near.slice(-6)] : near;
  for (const g of shown) {
    console.log(
      g
        ? `    ${g.name} @${rel(g.ts)} ${(g.dur / 1000).toFixed(2)} ms ${JSON.stringify(g.args)}`
        : `    ... (${near.length - 12} more)`,
    );
  }
}
