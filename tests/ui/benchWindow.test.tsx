// @vitest-environment jsdom
/**
 * `/?bench=1` also times the M03 process-window chart (25 × 25 samples) in the worker, so that the
 * 50 ms budget can be checked for M03 on a real phone. The table is there only when the report
 * carries the numbers; the tests of the M04 tables (bench.test.tsx) use reports without them.
 */
import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../../src/App';
import type { BenchReport } from '../../src/workers/simService';
import { CANNED_BENCH, CANNED_BENCH_MAIN, inlineClient } from './clients';

const window25 = (totalMs: number[]) => ({ doseSteps: 25, defocusSteps: 25, totalMs });

/** Twenty runs: 1 … 19 ms and one of 100 ms, so median (10,5), p95 (19) and max (100) all differ. */
const SAMPLES = [...Array.from({ length: 19 }, (_, i) => i + 1), 100];
const WITH_WINDOW: BenchReport = { ...CANNED_BENCH, processWindow: window25(SAMPLES) };
/** Twice as slow on the main thread: median 21, p95 38, max 200. */
const MAIN_WITH_WINDOW: BenchReport = {
  ...CANNED_BENCH_MAIN,
  processWindow: window25(SAMPLES.map((ms) => 2 * ms)),
};

afterEach(() => {
  window.history.replaceState({}, '', '/');
});

const cells = (row: HTMLElement) =>
  within(row)
    .getAllByRole('cell')
    .map((c) => c.textContent);

describe('/?bench=1 with the process-window numbers', () => {
  it('shows the chart’s median, p95 and max, with how many times it ran', async () => {
    window.history.replaceState({}, '', '/?bench=1');
    render(<App createClient={() => inlineClient(async () => WITH_WINDOW)} />);
    const table = await screen.findByRole('table', { name: /cửa sổ quy trình/i });
    expect(table).toHaveTextContent('25×25');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Biểu đồ', 'Số lần', 'Trung vị', 'p95', 'Lớn nhất']);
    const [, row] = within(table).getAllByRole('row');
    expect(cells(row!)).toEqual(['20', '10,5 ms', '19,0 ms', '100,0 ms']);
  });

  it('puts the worker and the main thread side by side under thread=main', async () => {
    window.history.replaceState({}, '', '/?bench=1&thread=main');
    render(
      <App
        createClient={() => inlineClient(async () => WITH_WINDOW)}
        createMainBench={async () => async () => MAIN_WITH_WINDOW}
      />,
    );
    const table = await screen.findByRole('table', { name: /cửa sổ quy trình/i });
    const rows = within(table).getAllByRole('row');
    // count, then worker | main for the median, the p95 and the max
    expect(cells(rows[rows.length - 1]!)).toEqual([
      '20',
      '10,5',
      '21,0',
      '19,0',
      '38,0',
      '100,0',
      '200,0',
    ]);
  });

  it('puts a dash for the main thread when it sent no chart numbers', async () => {
    window.history.replaceState({}, '', '/?bench=1&thread=main');
    render(
      <App
        createClient={() => inlineClient(async () => WITH_WINDOW)}
        createMainBench={async () => async () => CANNED_BENCH_MAIN}
      />,
    );
    const table = await screen.findByRole('table', { name: /cửa sổ quy trình/i });
    const rows = within(table).getAllByRole('row');
    expect(cells(rows[rows.length - 1]!)).toEqual(['20', '10,5', '—', '19,0', '—', '100,0', '—']);
  });
});

describe('/?bench=1 without them', () => {
  it('does not show the chart table', async () => {
    window.history.replaceState({}, '', '/?bench=1');
    render(<App createClient={() => inlineClient()} />);
    await screen.findByRole('table', { name: /runRecipe/ });
    expect(screen.queryByRole('table', { name: /cửa sổ quy trình/i })).not.toBeInTheDocument();
  });
});
