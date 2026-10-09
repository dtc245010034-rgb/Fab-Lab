// node scripts/perf/analyze-trace.mjs <runsPerCase> <trace.json> [<trace.json> ...]
// Lines every benchmark run (performance.mark pairs) up with the GC events on the same thread and
// prints how many slow runs and how many normal runs overlap each kind of GC event.
// "Slow" = longer than 1.5 x the median of its case. Runs 1-9 are the warm-up and are skipped.
import { readFileSync } from 'node:fs';
import { summarize } from '../../src/sim/stats.ts';

const runsPerCase = Number(process.argv[2]);
const files = process.argv.slice(3);
if (!runsPerCase || files.length === 0) {
  console.error('usage: node scripts/perf/analyze-trace.mjs <runsPerCase> <trace.json> [...]');
  process.exit(1);
}
const WARMUP_RUNS = 9; // WARMUP_RUNS_PER_CASE x 3 cases
const caseOf = (i) =>
  i <= WARMUP_RUNS ? 'warm' : 'ABC'[Math.floor((i - WARMUP_RUNS - 1) / runsPerCase)];

const rows = [];
let minorTotal = 0;
let majorTotal = 0;
for (const file of files) {
  const trace = JSON.parse(readFileSync(file, 'utf8'));
  const events = trace.traceEvents ?? trace;
  const starts = new Map();
  const ends = new Map();
  let tid = null;
  let pid = null;
  for (const e of events) {
    const m = /^run-(start|end)-(\d+)$/.exec(e.name);
    if (!m) continue;
    tid = e.tid;
    pid = e.pid;
    (m[1] === 'start' ? starts : ends).set(Number(m[2]), e.ts);
  }
  const onThread = (e) => e.pid === pid && e.tid === tid;
  // MinorGC = scavenge of the young generation; MajorGC = a mark-compact pause; V8.GC_MC_* and
  // V8.GCFinalizeMC are phases of a major GC (including incremental marking steps).
  const gc = events.filter(
    (e) =>
      onThread(e) &&
      e.ph === 'X' &&
      (e.name === 'MinorGC' ||
        e.name === 'MajorGC' ||
        /GC_MARK_COMPACTOR|V8\.GCFinalizeMC|V8\.GC_MC/.test(e.name)),
  );
  // incremental/concurrent marking appears as async "Marking" begin/end pairs
  const marks = (ph) =>
    events
      .filter((e) => e.name === 'Marking' && e.ph === ph && e.pid === pid)
      .map((e) => e.ts)
      .sort((a, b) => a - b);
  const end = marks('e');
  const marking = marks('b').map((b, k) => [b, end[k] ?? b]);
  minorTotal += gc.filter((e) => e.name === 'MinorGC').length;
  majorTotal += gc.filter((e) => e.name === 'MajorGC').length;

  for (const [i, s] of starts) {
    const e = ends.get(i);
    if (e === undefined || caseOf(i) === 'warm') continue;
    const overlaps = (a0, a1) => a0 < e && a1 > s;
    const hit = gc.filter((x) => overlaps(x.ts, x.ts + x.dur));
    rows.push({
      i,
      c: caseOf(i),
      ms: (e - s) / 1000,
      minor: hit.filter((x) => x.name === 'MinorGC').length,
      major: hit.filter((x) => x.name !== 'MinorGC').length,
      marking: marking.filter(([b0, b1]) => overlaps(b0, b1)).length,
      gcMs: hit.reduce((a, x) => a + x.dur, 0) / 1000,
    });
  }
}

console.log(`on the run thread: MinorGC ${minorTotal}, MajorGC ${majorTotal} (all traces)`);
for (const id of ['A', 'B', 'C']) {
  const rs = rows.filter((r) => r.c === id);
  if (rs.length === 0) continue;
  const s = summarize(rs.map((r) => r.ms));
  for (const r of rs) r.slow = r.ms > 1.5 * s.medianMs;
  console.log(
    `case ${id}: ${s.count} runs, median ${s.medianMs.toFixed(2)} ms, max ${s.maxMs.toFixed(2)} ms, slow ${rs.filter((r) => r.slow).length}`,
  );
}
const slow = rows.filter((r) => r.slow);
const normal = rows.filter((r) => !r.slow);
const line = (label, test) =>
  console.log(
    `${label.padEnd(26)} slow ${String(slow.filter(test).length).padStart(3)}/${String(slow.length).padEnd(3)}  normal ${String(normal.filter(test).length).padStart(4)}/${normal.length}`,
  );
console.log('runs that overlap a ...');
line('Major GC (mark-compact)', (r) => r.major > 0);
line('Marking span', (r) => r.marking > 0);
line('Minor GC (scavenge)', (r) => r.minor > 0);
line('any GC event', (r) => r.minor + r.major > 0);
console.log('slowest 8 runs:');
for (const r of [...rows].sort((a, b) => b.ms - a.ms).slice(0, 8)) {
  console.log(
    `  ${r.c} #${r.i}  ${r.ms.toFixed(2)} ms  minor=${r.minor} major=${r.major} marking=${r.marking} gc=${r.gcMs.toFixed(2)} ms`,
  );
}
