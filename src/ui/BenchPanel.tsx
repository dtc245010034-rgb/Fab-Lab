import { useMemo, useSyncExternalStore } from 'react';
import { M04_CASES } from '../sim/cases';
import { BENCH_RUNS_PER_CASE, WARMUP_RUNS_PER_CASE } from '../sim/defaults';
import { summarize } from '../sim/stats';
import type { SimClient } from '../workers/simClient';
import type { BenchCaseReport, BenchReport } from '../workers/simService';
import { createBenchStore } from './benchStore';
import { describeRecipe, formatMs } from './describe';

/** Runs the benchmark when it mounts and again on request; see benchStore.ts. */
function useBench(createClient: () => SimClient) {
  const store = useMemo(() => createBenchStore(createClient, BENCH_RUNS_PER_CASE), [createClient]);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return { state, rerun: store.rerun };
}

function caseLabel(id: BenchCaseReport['id']): string {
  const found = M04_CASES.find((c) => c.id === id);
  if (!found) return id;
  const { etch } = found.recipe;
  return `${id} · ${describeRecipe(etch)} · cửa sổ ${found.recipe.litho.designNm} nm`;
}

function SummaryTable({
  title,
  report,
  samples,
}: {
  title: string;
  report: BenchReport;
  samples: (c: BenchCaseReport) => number[];
}) {
  return (
    <table className="bench-table">
      <caption>{title}</caption>
      <thead>
        <tr>
          <th scope="col">Ca</th>
          <th scope="col">Số lần</th>
          <th scope="col">Trung vị</th>
          <th scope="col">p95</th>
          <th scope="col">Lớn nhất</th>
        </tr>
      </thead>
      <tbody>
        {report.cases.map((c) => {
          const s = summarize(samples(c));
          return (
            <tr key={c.id}>
              <th scope="row">{caseLabel(c.id)}</th>
              <td>{s.count}</td>
              <td>{formatMs(s.medianMs)}</td>
              <td>{formatMs(s.p95Ms)}</td>
              <td>{formatMs(s.maxMs)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * `/?bench=1`: times the recompute of cases A, B, C in the worker so that the "warm < 50 ms"
 * criterion of docs/modules/m04-etch.md can be measured on a real phone. A tool for the people
 * building the course, not part of it.
 */
export default function BenchPanel({ createClient }: { createClient: () => SimClient }) {
  const { state, rerun } = useBench(createClient);
  const running = state.status === 'running';

  return (
    <main className="bench-page">
      <section className="viewer" aria-labelledby="bench-title" aria-busy={running}>
        <div className="vhead">
          <h2 id="bench-title">Đo tốc độ tính</h2>
        </div>
        <p className="caption">
          Mỗi ca chạy {BENCH_RUNS_PER_CASE} lần trong worker, sau khi worker đã chạy làm ấm{' '}
          {WARMUP_RUNS_PER_CASE * M04_CASES.length} lần. Đây là số warm theo quy ước của dự án (từ
          lần gọi thứ 9 trở đi trong cùng trang); số cold là lần chạy đầu tiên của trang, xem ở{' '}
          <code>?debug=1</code>. Chỉ đo phép tính trong worker, chưa gồm thời gian chuyển kết quả.
        </p>
        {running && <p role="status">Đang đo…</p>}
        {state.status === 'error' && (
          <p className="notice" role="alert">
            Không đo được. Hãy chạy lại hoặc tải lại trang.
          </p>
        )}
        {state.status === 'done' && (
          <>
            <SummaryTable
              title="Cả phép tính (runRecipe)"
              report={state.report}
              samples={(c) => c.totalMs}
            />
            <SummaryTable
              title="Riêng arrivalTime"
              report={state.report}
              samples={(c) => c.arrivalMs}
            />
          </>
        )}
        <div className="row">
          <button type="button" className="btn" onClick={rerun} disabled={running}>
            Chạy lại
          </button>
        </div>
        <dl className="bench-env">
          <div>
            <dt>Trình duyệt</dt>
            <dd>{navigator.userAgent}</dd>
          </div>
          <div>
            <dt>Luồng CPU</dt>
            <dd>{navigator.hardwareConcurrency}</dd>
          </div>
          <div>
            <dt>devicePixelRatio</dt>
            <dd>{window.devicePixelRatio}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
