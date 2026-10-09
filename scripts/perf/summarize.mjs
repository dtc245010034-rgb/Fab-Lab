// node scripts/perf/summarize.mjs scripts/perf/out/results-<label>.json
// Median / p95 / max per case with all loads pooled (the same `summarize` as ?bench=1 uses).
import { readFileSync } from 'node:fs';
import { summarize } from '../../src/sim/stats.ts';

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/perf/summarize.mjs <results-file.json>');
  process.exit(1);
}
const r = JSON.parse(readFileSync(file, 'utf8'));
const f = (x) => x.toFixed(1).padStart(6);
console.log(
  `${r.label}: chrome ${r.version}, CPU ${r.rate}x, ${r.where}, warm=${r.warm}, mode ${r.mode}`,
);

if (r.mode === 'bench') {
  for (const key of ['totalMs', 'arrivalMs']) {
    console.log(`  ${key}     n  median    p95    max`);
    for (const id of ['A', 'B', 'C']) {
      const s = summarize(r.loads.flatMap((l) => l.cases.find((c) => c.id === id)[key]));
      console.log(
        `    ${id}   ${String(s.count).padStart(4)} ${f(s.medianMs)} ${f(s.p95Ms)} ${f(s.maxMs)}`,
      );
    }
  }
} else {
  // learner mode: median of each call over the loads, as "in the computation (round trip)"
  for (const { call } of r.loads[0].calls) {
    const same = r.loads.map((l) => l.calls.find((c) => c.call === call));
    const inside = summarize(same.map((c) => c.inWorkerMs)).medianMs;
    const trip = summarize(same.map((c) => c.ms)).medianMs;
    console.log(
      `  call ${call}${same[0].caseId ?? 'B'}: ${f(inside)} ms (round trip ${f(trip)} ms)`,
    );
  }
}
