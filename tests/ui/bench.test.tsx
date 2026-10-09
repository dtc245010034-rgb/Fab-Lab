// @vitest-environment jsdom
/**
 * `/?bench=1` replaces the lab with a page that times the worker on cases A, B, C and shows
 * median / p95 / max, so the "warm < 50 ms" criterion can be measured on a real phone.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/App';
import { BENCH_RUNS_PER_CASE } from '../../src/sim/defaults';
import {
  CANNED_BENCH,
  CANNED_BENCH_MAIN,
  inlineClient,
  manualClient,
  type TestClient,
} from './clients';

const inlineFactory = () => inlineClient();

afterEach(() => {
  window.history.replaceState({}, '', '/');
});

function openBench() {
  window.history.replaceState({}, '', '/?bench=1');
}

describe('/?bench=1', () => {
  it('shows the benchmark instead of the lab', async () => {
    openBench();
    render(<App createClient={inlineFactory} />);
    expect(await screen.findByRole('region', { name: /đo tốc độ tính/i })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /mặt cắt wafer/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('complementary', { name: /phiếu công đoạn/i }),
    ).not.toBeInTheDocument();
  });

  it('still shows the lab without the parameter', async () => {
    render(<App createClient={inlineFactory} />);
    // wait for the picture: the empty frame before it has the same name as the Viewer
    await screen.findByRole('img', { name: /mặt cắt wafer/i });
    expect(screen.getByRole('region', { name: /mặt cắt wafer/i })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /đo tốc độ tính/i })).not.toBeInTheDocument();
  });

  it('says it is measuring until the numbers come back', async () => {
    openBench();
    const { client, benches } = manualClient();
    render(<App createClient={() => client} />);
    const region = screen.getByRole('region', { name: /đo tốc độ tính/i });
    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(within(region).getByRole('status')).toHaveTextContent(/đang đo/i);
    await waitFor(() => expect(benches).toHaveLength(1));
    expect(client.benched).toEqual([BENCH_RUNS_PER_CASE]);

    await act(async () => benches[0]!.resolve(CANNED_BENCH));
    expect(region).not.toHaveAttribute('aria-busy', 'true');
    expect(within(region).queryByRole('status')).not.toBeInTheDocument();
  });

  it('lists median, p95 and max per case, for runRecipe and for arrivalTime', async () => {
    openBench();
    render(<App createClient={inlineFactory} />);
    const total = await screen.findByRole('table', { name: /runRecipe/ });
    const header = within(total)
      .getAllByRole('columnheader')
      .map((h) => h.textContent);
    expect(header).toEqual(['Ca', 'Số lần', 'Trung vị', 'p95', 'Lớn nhất']);

    // each row: the case as the row header, then count, median, p95, max
    const rows = within(total).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    const cells = (row: HTMLElement) =>
      within(row)
        .getAllByRole('cell')
        .map((c) => c.textContent);
    expect(within(rows[0]!).getByRole('rowheader')).toHaveTextContent(/^A/);
    expect(within(rows[1]!).getByRole('rowheader')).toHaveTextContent(/^B/);
    expect(within(rows[2]!).getByRole('rowheader')).toHaveTextContent(/^C/);
    // A: 3, 4, 5, 6, 40 → median 5; p95 is the nearest rank of 5 samples = 40; max 40
    expect(cells(rows[0]!)).toEqual(['5', '5,0 ms', '40,0 ms', '40,0 ms']);
    expect(cells(rows[1]!)).toEqual(['5', '12,0 ms', '14,0 ms', '14,0 ms']);
    expect(cells(rows[2]!)).toEqual(['5', '22,0 ms', '90,0 ms', '90,0 ms']);

    // arrivalTime alone: A is 1, 1.5, 2, 2.5, 30 → median 2
    const arrival = screen.getByRole('table', { name: /arrivalTime/ });
    const arrivalRows = within(arrival).getAllByRole('row').slice(1);
    expect(arrivalRows).toHaveLength(3);
    expect(cells(arrivalRows[0]!)).toEqual(['5', '2,0 ms', '30,0 ms', '30,0 ms']);
  });

  it('says what the numbers are: warm, after the worker warmed up', async () => {
    openBench();
    render(<App createClient={inlineFactory} />);
    await screen.findByRole('table', { name: /runRecipe/ });
    expect(screen.getByText(/làm ấm/i)).toBeInTheDocument();
  });

  it('shows where it ran: the browser, the logical processors and the pixel ratio', async () => {
    openBench();
    render(<App createClient={inlineFactory} />);
    await screen.findByRole('table', { name: /runRecipe/ });
    expect(screen.getByText(/trình duyệt/i)).toBeInTheDocument();
    expect(screen.getByText(/luồng cpu/i)).toBeInTheDocument();
    expect(screen.getByText(/devicePixelRatio/)).toBeInTheDocument();
  });

  it('measures again on the same worker when asked', async () => {
    openBench();
    const client = inlineClient();
    render(<App createClient={() => client} />);
    await screen.findByRole('table', { name: /runRecipe/ });
    expect(client.benched).toEqual([BENCH_RUNS_PER_CASE]);

    fireEvent.click(screen.getByRole('button', { name: /chạy lại/i }));
    await waitFor(() => expect(client.benched).toEqual([BENCH_RUNS_PER_CASE, BENCH_RUNS_PER_CASE]));
    await screen.findByRole('table', { name: /runRecipe/ });
  });

  it('says so and offers another try when the measurement fails', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    openBench();
    const { client, benches } = manualClient();
    render(<App createClient={() => client} />);
    await waitFor(() => expect(benches).toHaveLength(1));
    await act(async () => benches[0]!.reject(new Error('worker failed to start')));
    expect(await screen.findByRole('alert')).toHaveTextContent(/không đo được/i);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /chạy lại/i })).toBeEnabled();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it('does not show the main thread, or time it, without thread=main', async () => {
    openBench();
    let asked = 0;
    render(
      <App
        createClient={inlineFactory}
        createMainBench={async () => {
          asked++;
          return async () => CANNED_BENCH_MAIN;
        }}
      />,
    );
    await screen.findByRole('table', { name: /runRecipe/ });
    expect(asked).toBe(0);
    expect(screen.queryByRole('table', { name: /tỉ số/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /luồng chính/i })).not.toBeInTheDocument();
  });

  it('under StrictMode leaves one live worker, and none after unmount', async () => {
    openBench();
    const created: TestClient[] = [];
    const factory = () => {
      const client = inlineClient();
      created.push(client);
      return client;
    };
    const { unmount } = render(
      <StrictMode>
        <App createClient={factory} />
      </StrictMode>,
    );
    await screen.findByRole('table', { name: /runRecipe/ });
    expect(created.filter((c) => !c.disposed)).toHaveLength(1);
    unmount();
    expect(created.every((c) => c.disposed)).toBe(true);
  });
});

describe('/?bench=1&thread=main', () => {
  function openBenchMain() {
    window.history.replaceState({}, '', '/?bench=1&thread=main');
  }
  const mainFactory = async () => async () => CANNED_BENCH_MAIN;
  const cells = (row: HTMLElement) =>
    within(row)
      .getAllByRole('cell')
      .map((c) => c.textContent);

  it('says it is measuring until the main thread has answered too', async () => {
    openBenchMain();
    let finish: (report: typeof CANNED_BENCH_MAIN) => void = () => {};
    render(
      <App
        createClient={inlineFactory}
        createMainBench={async () => () => new Promise((resolve) => (finish = resolve))}
      />,
    );
    const region = screen.getByRole('region', { name: /đo tốc độ tính/i });
    await waitFor(() => expect(finish).not.toBe(undefined));
    // the worker’s numbers are in (inline client) but the page waits for the main thread
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    await act(async () => finish(CANNED_BENCH_MAIN));
    expect(region).not.toHaveAttribute('aria-busy', 'true');
    expect(screen.getAllByRole('table')).toHaveLength(2 + 1);
  });

  it('puts the worker and the main thread side by side: median, p95 and max for each', async () => {
    openBenchMain();
    render(<App createClient={inlineFactory} createMainBench={mainFactory} />);
    const total = await screen.findByRole('table', { name: /runRecipe/ });

    const headers = within(total)
      .getAllByRole('columnheader')
      .map((h) => h.textContent);
    expect(headers).toEqual([
      'Ca',
      'Số lần',
      'Trung vị',
      'p95',
      'Lớn nhất',
      ...Array.from({ length: 3 }, () => ['Worker', 'Luồng chính']).flat(),
    ]);

    // two header rows, then A, B, C. Cells: count, then (worker, main) for median, p95, max.
    const rows = within(total).getAllByRole('row').slice(2);
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByRole('rowheader')).toHaveTextContent(/^A$/);
    expect(within(rows[1]!).getByRole('rowheader')).toHaveTextContent(/^B$/);
    expect(within(rows[2]!).getByRole('rowheader')).toHaveTextContent(/^C$/);
    // A: worker 3,4,5,6,40 → 5 / 40 / 40; main is twice that → 10 / 80 / 80
    expect(cells(rows[0]!)).toEqual(['5', '5,0', '10,0', '40,0', '80,0', '40,0', '80,0']);
    // B: worker 10..14 → 12 / 14 / 14; main is half → 6 / 7 / 7
    expect(cells(rows[1]!)).toEqual(['5', '12,0', '6,0', '14,0', '7,0', '14,0', '7,0']);
    // C: the same on both threads
    expect(cells(rows[2]!)).toEqual(['5', '22,0', '22,0', '90,0', '90,0', '90,0', '90,0']);
  });

  it('does the same for arrivalTime alone', async () => {
    openBenchMain();
    render(<App createClient={inlineFactory} createMainBench={mainFactory} />);
    const arrival = await screen.findByRole('table', { name: /arrivalTime/ });
    const rows = within(arrival).getAllByRole('row').slice(2);
    // A: worker 1, 1.5, 2, 2.5, 30 → 2 / 30 / 30; main twice that
    expect(cells(rows[0]!)).toEqual(['5', '2,0', '4,0', '30,0', '60,0', '30,0', '60,0']);
  });

  it('has a row per case with the ratio of the medians, main thread ÷ worker', async () => {
    openBenchMain();
    render(<App createClient={inlineFactory} createMainBench={mainFactory} />);
    const ratios = await screen.findByRole('table', { name: /tỉ số trung vị/i });
    expect(
      within(ratios)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Ca', 'runRecipe', 'arrivalTime']);
    const rows = within(ratios).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByRole('rowheader')).toHaveTextContent(/^A$/);
    expect(cells(rows[0]!)).toEqual(['2,00×', '2,00×']); // main twice as slow
    expect(cells(rows[1]!)).toEqual(['0,50×', '0,50×']); // main twice as fast
    expect(cells(rows[2]!)).toEqual(['1,00×', '1,00×']);
  });

  it('shows a dash instead of a ratio when the worker’s median is 0', async () => {
    openBenchMain();
    const zero = {
      cases: CANNED_BENCH.cases.map((c) => ({
        id: c.id,
        totalMs: c.totalMs.map(() => 0),
        arrivalMs: c.arrivalMs.map(() => 0),
      })),
    };
    render(
      <App createClient={() => inlineClient(async () => zero)} createMainBench={mainFactory} />,
    );
    const ratios = await screen.findByRole('table', { name: /tỉ số trung vị/i });
    const rows = within(ratios).getAllByRole('row').slice(1);
    expect(cells(rows[0]!)).toEqual(['—', '—']);
  });

  it('says what each case is, once, above the tables (the tables use only A, B, C)', async () => {
    openBenchMain();
    render(<App createClient={inlineFactory} createMainBench={mainFactory} />);
    await screen.findByRole('table', { name: /runRecipe/ });
    expect(screen.getByText(/A · BOE 6:1 · 3,3 phút · cửa sổ 800 nm/)).toBeInTheDocument();
    expect(
      screen.getByText(/B · RIE 200 W · 30 mTorr · 4,6 phút · cửa sổ 800 nm/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/C · RIE 80 W · 180 mTorr · 9 phút · cửa sổ 400 nm/),
    ).toBeInTheDocument();
  });

  it('explains how to read it: both threads warmed up the same way, and what a ratio below 1 means', async () => {
    openBenchMain();
    render(<App createClient={inlineFactory} createMainBench={mainFactory} />);
    await screen.findByRole('table', { name: /runRecipe/ });
    expect(screen.getByText(/luồng chính cũng được làm ấm/i)).toBeInTheDocument();
    expect(screen.getByText(/dưới 1×/i)).toBeInTheDocument();
  });

  it('says so and offers another try when the main thread fails', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    openBenchMain();
    render(
      <App
        createClient={inlineFactory}
        createMainBench={async () => async () => {
          throw new Error('main thread failed');
        }}
      />,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(/không đo được/i);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /chạy lại/i })).toBeEnabled();
    log.mockRestore();
  });

  it('measures both threads again when asked', async () => {
    openBenchMain();
    let loads = 0;
    let runs = 0;
    render(
      <App
        createClient={inlineFactory}
        createMainBench={async () => {
          loads++;
          return async () => {
            runs++;
            return CANNED_BENCH_MAIN;
          };
        }}
      />,
    );
    await screen.findByRole('table', { name: /runRecipe/ });
    fireEvent.click(screen.getByRole('button', { name: /chạy lại/i }));
    await waitFor(() => expect(runs).toBe(2));
    await screen.findByRole('table', { name: /runRecipe/ });
    expect(loads).toBe(1);
  });
});
