import { Fragment, useMemo, useSyncExternalStore } from 'react';
import { M04_CASES } from '../sim/cases';
import { BENCH_RUNS_PER_CASE, WARMUP_RUNS_PER_CASE } from '../sim/defaults';
import { summarize, type Summary } from '../sim/stats';
import type { SimClient } from '../workers/simClient';
import type { BenchCaseReport, BenchReport } from '../workers/simService';
import { createBenchStore, type MainBench } from './benchStore';
import { describeRecipe, formatMs, formatMsValue, formatRatio } from './describe';

/** Runs the benchmark when it mounts and again on request; see benchStore.ts. */
function useBench(createClient: () => SimClient, createMainBench?: () => Promise<MainBench>) {
  const store = useMemo(
    () => createBenchStore(createClient, BENCH_RUNS_PER_CASE, createMainBench),
    [createClient, createMainBench],
  );
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

const STAT_COLUMNS = [
  ['Trung vị', (s: Summary) => s.medianMs],
  ['p95', (s: Summary) => s.p95Ms],
  ['Lớn nhất', (s: Summary) => s.maxMs],
] as const;

/**
 * Worker and main thread side by side (`?bench=1&thread=main`): median, p95 and max, each with the
 * worker's number next to the main thread's. Bare numbers and one-letter cases keep it inside a
 * 380 px screen; the unit is in the caption and the cases are described above the tables.
 */
function PairedTable({
  title,
  report,
  main,
  samples,
}: {
  title: string;
  report: BenchReport;
  main: BenchReport;
  samples: (c: BenchCaseReport) => number[];
}) {
  return (
    <table className="bench-table bench-table--paired">
      <caption>{title}</caption>
      <thead>
        <tr>
          <th scope="col" rowSpan={2}>
            Ca
          </th>
          <th scope="col" rowSpan={2}>
            Số lần
          </th>
          {STAT_COLUMNS.map(([name]) => (
            <th key={name} scope="colgroup" colSpan={2}>
              {name}
            </th>
          ))}
        </tr>
        <tr>
          {STAT_COLUMNS.map(([name]) => (
            <Fragment key={name}>
              <th scope="col">Worker</th>
              <th scope="col">Luồng chính</th>
            </Fragment>
          ))}
        </tr>
      </thead>
      <tbody>
        {report.cases.map((c) => {
          const worker = summarize(samples(c));
          const mainCase = main.cases.find((m) => m.id === c.id);
          const onMain = mainCase ? summarize(samples(mainCase)) : null;
          return (
            <tr key={c.id}>
              <th scope="row">{c.id}</th>
              <td>{worker.count}</td>
              {STAT_COLUMNS.map(([name, pick]) => (
                <Fragment key={name}>
                  <td>{formatMsValue(pick(worker))}</td>
                  <td>{onMain ? formatMsValue(pick(onMain)) : '—'}</td>
                </Fragment>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Median on the main thread ÷ median in the worker, per case: below 1× the main thread is faster. */
function RatioTable({ report, main }: { report: BenchReport; main: BenchReport }) {
  const ratio = (c: BenchCaseReport, samples: (c: BenchCaseReport) => number[]) => {
    const mainCase = main.cases.find((m) => m.id === c.id);
    return mainCase
      ? summarize(samples(mainCase)).medianMs / summarize(samples(c)).medianMs
      : Number.NaN;
  };
  return (
    <table className="bench-table bench-table--paired">
      <caption>Tỉ số trung vị (luồng chính ÷ worker)</caption>
      <thead>
        <tr>
          <th scope="col">Ca</th>
          <th scope="col">runRecipe</th>
          <th scope="col">arrivalTime</th>
        </tr>
      </thead>
      <tbody>
        {report.cases.map((c) => (
          <tr key={c.id}>
            <th scope="row">{c.id}</th>
            <td>{formatRatio(ratio(c, (x) => x.totalMs))}</td>
            <td>{formatRatio(ratio(c, (x) => x.arrivalMs))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * `/?bench=1`: times the recompute of cases A, B, C in the worker so that the "warm < 50 ms"
 * criterion of docs/modules/m04-etch.md can be measured on a real phone. With `&thread=main` the
 * same numbers are also taken on the page's main thread, to see whether the worker is slower than
 * the main thread on that device. A tool for the people building the course, not part of it.
 */
export default function BenchPanel({
  createClient,
  createMainBench,
}: {
  createClient: () => SimClient;
  /** Given only for `thread=main`. */
  createMainBench?: () => Promise<MainBench>;
}) {
  const { state, rerun } = useBench(createClient, createMainBench);
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
        {createMainBench && (
          <p className="caption">
            Cột “Luồng chính” là cùng phép tính chạy ngay trên luồng của trang (chỉ trang đo này làm
            vậy; trang học luôn tính trong worker). Luồng chính cũng được làm ấm{' '}
            {WARMUP_RUNS_PER_CASE * M04_CASES.length} lần (A, B, C × {WARMUP_RUNS_PER_CASE}) như
            worker rồi mới đo, vì JIT làm ấm riêng theo từng luồng. Hai luồng đo lần lượt, không
            song song. Tỉ số dưới 1× nghĩa là luồng chính nhanh hơn worker.
          </p>
        )}
        {running && <p role="status">Đang đo…</p>}
        {state.status === 'error' && (
          <p className="notice" role="alert">
            Không đo được. Hãy chạy lại hoặc tải lại trang.
          </p>
        )}
        {state.status === 'done' && state.main && (
          <>
            <ul className="bench-cases">
              {state.report.cases.map((c) => (
                <li key={c.id}>{caseLabel(c.id)}</li>
              ))}
            </ul>
            <PairedTable
              title="Cả phép tính (runRecipe), ms"
              report={state.report}
              main={state.main}
              samples={(c) => c.totalMs}
            />
            <PairedTable
              title="Riêng arrivalTime, ms"
              report={state.report}
              main={state.main}
              samples={(c) => c.arrivalMs}
            />
            <RatioTable report={state.report} main={state.main} />
          </>
        )}
        {state.status === 'done' && !state.main && (
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
